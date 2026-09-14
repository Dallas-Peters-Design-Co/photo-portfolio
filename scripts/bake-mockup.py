#!/usr/bin/env python3
"""
Bakes a Photoshop mockup PSD into three pictures the browser can use.

    python3 scripts/bake-mockup.py src/templates/9180-1-book-cover-mockup.psd \
        --id book-front --label "Paperback, front" --scale 0.5 \
        --out public/mockups

A bought mockup is a layered document: a photograph of a blank book, a Smart
Object where the cover goes (perspective-transformed and usually warped), and
a stack of shading layers over it — multiply for shadow, screen for light,
overlay for sheen. None of that opens in a browser. What does is arithmetic:
for every pixel, the finished picture is (very nearly) a per-channel affine
function of the cover pixel underneath it,

    out = A + B · cover

which is exact for normal, multiply, screen and linear-burn layers and a close
fit for overlay and soft light. A and B come from rendering the whole document
twice, once with the cover all black and once all white: A is the black
render, B the difference. Where no cover shows, B is zero and A is the
photograph.

The third picture is the UV map: for every canvas pixel, which point of the
cover lands there. It carries the Smart Object's transform *and* its warp mesh,
so a curled page or a bowed spine is reproduced rather than approximated with
a flat quad. Encoded as 12 bits per axis across a PNG's colour channels.

The renderer (src/boards/canvas/mockupTemplate.ts) then does one texture
lookup and one multiply-add per pixel, which is nothing.

Requires psd-tools, numpy and Pillow:  pip install psd-tools numpy pillow
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from psd_tools import PSDImage
from psd_tools.constants import BlendMode

# ---------------------------------------------------------------- blending

def _soft_light(d, s):
    D = np.where(d <= 0.25, ((16 * d - 12) * d + 4) * d, np.sqrt(d))
    return np.where(s <= 0.5, d - (1 - 2 * s) * d * (1 - d), d + (2 * s - 1) * (D - d))


BLENDS = {
    BlendMode.NORMAL: lambda d, s: s,
    BlendMode.MULTIPLY: lambda d, s: d * s,
    BlendMode.SCREEN: lambda d, s: 1 - (1 - d) * (1 - s),
    BlendMode.OVERLAY: lambda d, s: np.where(d <= 0.5, 2 * d * s, 1 - 2 * (1 - d) * (1 - s)),
    BlendMode.SOFT_LIGHT: _soft_light,
    BlendMode.HARD_LIGHT: lambda d, s: np.where(s <= 0.5, 2 * d * s, 1 - 2 * (1 - d) * (1 - s)),
    BlendMode.LINEAR_BURN: lambda d, s: np.clip(d + s - 1, 0, 1),
    BlendMode.LINEAR_DODGE: lambda d, s: np.clip(d + s, 0, 1),
    BlendMode.COLOR_BURN: lambda d, s: np.where(s <= 0, 0, 1 - np.clip((1 - d) / np.maximum(s, 1e-6), 0, 1)),
    BlendMode.COLOR_DODGE: lambda d, s: np.where(s >= 1, 1, np.clip(d / np.maximum(1 - s, 1e-6), 0, 1)),
    BlendMode.DARKEN: np.minimum,
    BlendMode.LIGHTEN: np.maximum,
}


def over(dst, src, mode, opacity):
    """Composite straight-alpha `src` (h,w,4 floats) onto `dst` with a blend mode."""
    fn = BLENDS.get(mode)
    if fn is None:
        print(f"  ! blend {mode} not implemented, using normal", file=sys.stderr)
        fn = BLENDS[BlendMode.NORMAL]
    a_s = src[..., 3:4] * opacity
    a_d = dst[..., 3:4]
    rgb_d = dst[..., :3]
    rgb_s = src[..., :3]
    blended = (1 - a_d) * rgb_s + a_d * fn(rgb_d, rgb_s)
    a_o = a_s + a_d * (1 - a_s)
    rgb_o = np.where(
        a_o > 0,
        ((1 - a_s) * a_d * rgb_d + a_s * blended) / np.maximum(a_o, 1e-6),
        0,
    )
    return np.concatenate([rgb_o, a_o], axis=-1)


# ---------------------------------------------------------------- layers

def raster(layer, viewport):
    """A layer alone, straight alpha, as floats on the whole canvas."""
    h, w = viewport[3] - viewport[1], viewport[2] - viewport[0]
    im = layer.composite(viewport=viewport)
    out = (
        np.asarray(im.convert("RGBA")).astype(np.float32) / 255
        if im is not None
        else np.zeros((h, w, 4), np.float32)
    )
    if out[..., 3].max() > 0:
        return out
    # psd-tools composites a clipped Smart Object (one drawn only where the
    # layer under it has pixels) as nothing at all. Its own pixels are still
    # there; place them at the layer's box and let the clipping step decide
    # where they show.
    try:
        px = layer.numpy()
    except Exception:
        return out
    if px is None or px.ndim != 3:
        return out
    if px.shape[-1] == 3:
        px = np.concatenate([px, np.ones(px.shape[:2] + (1,), px.dtype)], axis=-1)
    x0, y0, x1, y1 = layer.bbox
    sx0, sy0 = max(0, x0 - viewport[0]), max(0, y0 - viewport[1])
    sx1, sy1 = min(w, x1 - viewport[0]), min(h, y1 - viewport[1])
    if sx1 <= sx0 or sy1 <= sy0:
        return out
    ox, oy = sx0 - (x0 - viewport[0]), sy0 - (y0 - viewport[1])
    out[sy0:sy1, sx0:sx1] = px[oy : oy + (sy1 - sy0), ox : ox + (sx1 - sx0)].astype(np.float32)
    return out


def render(layers, viewport, fills):
    """
    Composites `layers` bottom-up. Each Smart Object in `fills` — a map of
    layer → (fill value 0..1, alpha array) — is replaced by that flat value
    inside its own alpha (its shape, its mask), which is how a render "with
    the cover all black" is made.
    """
    h, w = viewport[3] - viewport[1], viewport[2] - viewport[0]
    stack = np.zeros((h, w, 4), np.float32)
    items = list(layers)
    i = 0
    while i < len(items):
        layer = items[i]
        i += 1
        if not layer.visible:
            continue
        opacity = layer.opacity / 255
        if layer.is_group():
            if layer.blend_mode == BlendMode.PASS_THROUGH:
                stack = render_into(stack, layer, viewport, fills)
            else:
                inner = render(list(layer), viewport, fills)
                stack = over(stack, inner, layer.blend_mode, opacity)
            continue
        if layer in fills:
            value, alpha = fills[layer]
            src = np.zeros((h, w, 4), np.float32)
            src[..., :3] = value
            src[..., 3] = alpha
        else:
            src = raster(layer, viewport)
        # Layers clipped to this one: blend them onto it first, within its alpha.
        while i < len(items) and getattr(items[i], "clipping", False):
            clip = items[i]
            i += 1
            if not clip.visible:
                continue
            if clip in fills:
                value, alpha = fills[clip]
                c = np.zeros((h, w, 4), np.float32)
                c[..., :3] = value
                c[..., 3] = alpha
            else:
                c = raster(clip, viewport)
            c[..., 3] *= src[..., 3]
            base_alpha = src[..., 3:4].copy()
            src = over(src, c, clip.blend_mode, clip.opacity / 255)
            src[..., 3:4] = base_alpha
        stack = over(stack, src, layer.blend_mode, opacity)
    return stack


def render_into(stack, group, viewport, fills):
    """A pass-through group: its layers land on the stack as if ungrouped."""
    items = list(group)
    i = 0
    h, w = stack.shape[:2]
    while i < len(items):
        layer = items[i]
        i += 1
        if not layer.visible:
            continue
        opacity = layer.opacity / 255
        if layer.is_group():
            if layer.blend_mode == BlendMode.PASS_THROUGH:
                stack = render_into(stack, layer, viewport, fills)
            else:
                inner = render(list(layer), viewport, fills)
                stack = over(stack, inner, layer.blend_mode, opacity)
            continue
        if layer in fills:
            value, alpha = fills[layer]
            src = np.zeros((h, w, 4), np.float32)
            src[..., :3] = value
            src[..., 3] = alpha
        else:
            src = raster(layer, viewport)
        while i < len(items) and getattr(items[i], "clipping", False):
            clip = items[i]
            i += 1
            if not clip.visible:
                continue
            if clip in fills:
                value, alpha = fills[clip]
                c = np.zeros((h, w, 4), np.float32)
                c[..., :3] = value
                c[..., 3] = alpha
            else:
                c = raster(clip, viewport)
            c[..., 3] *= src[..., 3]
            base_alpha = src[..., 3:4].copy()
            src = over(src, c, clip.blend_mode, clip.opacity / 255)
            src[..., 3:4] = base_alpha
        stack = over(stack, src, layer.blend_mode, opacity)
    return stack


# ---------------------------------------------------------------- warp + uv

def bezier_surface(mesh_x, mesh_y, u, v):
    """Cubic Bézier patch through a 4×4 mesh, evaluated at (u, v) in 0..1."""
    def basis(t):
        return np.stack([(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], -1)
    bu = basis(u)  # (...,4)
    bv = basis(v)
    X = np.einsum("...i,ij,...j->...", bv, mesh_x, bu)
    Y = np.einsum("...i,ij,...j->...", bv, mesh_y, bu)
    return X, Y


def homography_from_points(src, dst):
    """3×3 mapping four src points to four dst points (DLT, direct solve)."""
    A = []
    b = []
    for (x, y), (X, Y) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        b.append(X)
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
        b.append(Y)
    h = np.linalg.solve(np.array(A, float), np.array(b, float))
    return np.array([[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]])


def uv_map(so, viewport, so_alpha, scale):
    """
    For every output pixel inside the cover, the (u, v) of the cover point
    that lands there. Built forward — a fine grid of source points pushed
    through the warp and the transform, then filled in — because a Bézier
    surface has no closed inverse and a forward scatter of a dense grid is
    both simple and exact to the pixel.
    """
    smart = so.smart_object
    warp = smart.warp
    bounds = warp[b"bounds"]
    left, top = float(bounds[b"Left"]), float(bounds[b"Top "])
    right, bottom = float(bounds[b"Rght"]), float(bounds[b"Btom"])
    sw, sh = right - left, bottom - top

    if warp[b"warpStyle"].enum == b"warpCustom":
        mp = warp[b"customEnvelopeWarp"][b"meshPoints"]
        hz = np.array(list(mp[b"Hrzn"]), float).reshape(4, 4)
        vt = np.array(list(mp[b"Vrtc"]), float).reshape(4, 4)
    else:
        gx = np.array([left, left + sw / 3, left + 2 * sw / 3, right])
        gy = np.array([top, top + sh / 3, top + 2 * sh / 3, bottom])
        hz = np.tile(gx, (4, 1))
        vt = np.tile(gy[:, None], (1, 4))

    tb = smart.transform_box
    quad = [(tb[0], tb[1]), (tb[2], tb[3]), (tb[4], tb[5]), (tb[6], tb[7])]
    src_corners = [(left, top), (right, top), (right, bottom), (left, bottom)]
    H = homography_from_points(src_corners, quad)

    ow = int(round((viewport[2] - viewport[0]) * scale))
    oh = int(round((viewport[3] - viewport[1]) * scale))
    # Dense enough that neighbouring samples land on adjacent output pixels.
    n_u = int(sw * scale * 1.5) + 2
    n_v = int(sh * scale * 1.5) + 2
    u = np.linspace(0, 1, n_u)
    v = np.linspace(0, 1, n_v)
    U, V = np.meshgrid(u, v)
    X, Y = bezier_surface(hz, vt, U, V)  # in source space
    pts = np.stack([X, Y, np.ones_like(X)], -1) @ H.T
    px = (pts[..., 0] / pts[..., 2] - viewport[0]) * scale
    py = (pts[..., 1] / pts[..., 2] - viewport[1]) * scale

    uv = np.full((oh, ow, 2), -1.0, np.float32)
    xi = np.clip(np.round(px).astype(int), 0, ow - 1)
    yi = np.clip(np.round(py).astype(int), 0, oh - 1)
    uv[yi.ravel(), xi.ravel(), 0] = U.ravel()
    uv[yi.ravel(), xi.ravel(), 1] = V.ravel()

    # Fill the odd pixel the scatter missed from its neighbours, inside the
    # cover's alpha only.
    from scipy import ndimage as ndi
    inside = ndi.zoom(so_alpha, scale, order=1) > 0.02 if scale != 1 else so_alpha > 0.02
    inside = inside[:oh, :ow]
    missing = (uv[..., 0] < 0) & inside
    if missing.any():
        for c in range(2):
            ch = uv[..., c]
            known = ch >= 0
            idx = ndi.distance_transform_edt(~known, return_distances=False, return_indices=True)
            filled = ch[idx[0], idx[1]]
            ch[missing] = filled[missing]
    uv[~inside] = -1
    return uv, (sw, sh)


def encode_uv(uv):
    """
    u and v as 12 bits each across R, G and B; alpha always opaque.

    Not across the alpha channel: a browser premultiplies a PNG's colour by
    its alpha on decode and divides it back out on read, and at low alpha that
    round trip destroys the low bits. Twelve bits is a step of 1/4096 of the
    cover — half a pixel of a 2048-wide sample — which is below what bilinear
    sampling can show. Outside the cover is 0,0,0; inside starts at 1 so the
    cover's own top-left corner cannot be mistaken for outside.
    """
    h, w = uv.shape[:2]
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 3] = 255
    inside = uv[..., 0] >= 0
    u12 = np.clip(np.round(uv[..., 0] * 4095), 1, 4095).astype(np.uint32)
    v12 = np.clip(np.round(uv[..., 1] * 4095), 0, 4095).astype(np.uint32)
    out[..., 0] = np.where(inside, u12 >> 4, 0)
    out[..., 1] = np.where(inside, v12 >> 4, 0)
    out[..., 2] = np.where(inside, ((u12 & 15) << 4) | (v12 & 15), 0)
    return out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("psd")
    ap.add_argument("--id", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", default="public/mockups")
    ap.add_argument("--scale", type=float, default=0.5)
    ap.add_argument("--layer", default=None, help="Name of the Smart Object to replace, if not the first visible one")
    ap.add_argument("--check", action="store_true", help="Also write a render with the PSD's own sample design, for comparing against Photoshop")
    args = ap.parse_args()

    psd = PSDImage.open(args.psd)
    # The canvas, not psd.bbox: a mockup's shadow layer often runs past the
    # edge of the document, and bbox is the union of the layers.
    W, H = psd.size
    viewport = (0, 0, W, H)

    sos = [l for l in psd.descendants() if l.kind == "smartobject" and l.visible and l.opacity > 0]
    if args.layer:
        sos = [l for l in sos if l.name == args.layer]

    # Some mockups carry a second, root-level copy of each design layer with
    # the same name and placement — a leftover of how they were built. It
    # would paint over the shading, so a duplicate of one already seen is
    # dropped, and hidden from the render.
    seen = set()
    kept = []
    for l in sos:
        key = (l.name, tuple(round(v) for v in l.smart_object.transform_box))
        if key in seen:
            l.visible = False
            continue
        seen.add(key)
        kept.append(l)
    sos = kept
    if not sos:
        sys.exit("No visible Smart Object to replace")

    # A Smart Object is a front, a back or a spine: by name when the mockup
    # says, otherwise by the shape of what it expects — a 1800×2700 source is
    # a front, a 270×2700 one is the strip beside it.
    def role_of(layer):
        if "back" in layer.name.lower():
            return "back"
        b = layer.smart_object.warp[b"bounds"]
        sw = float(b[b"Rght"]) - float(b[b"Left"])
        sh = float(b[b"Btom"]) - float(b[b"Top "])
        return "spine" if sw / max(sh, 1) < 0.25 else "cover"

    roles = {l: role_of(l) for l in sos}
    alphas = {l: raster(l, viewport)[..., 3] for l in sos}
    for l in sos:
        print(f"  {roles[l]:5s} {l.name!r} bbox={l.bbox}")

    def fills(cover, spine, back):
        return {
            l: ({"cover": cover, "spine": spine, "back": back}[roles[l]], alphas[l])
            for l in sos
        }

    print("Rendering: everything black…")
    base = render(list(psd), viewport, fills(0.0, 0.0, 0.0))
    A = np.clip(base[..., :3], 0, 1)
    del base
    print("Rendering: covers white…")
    B = np.clip(render(list(psd), viewport, fills(1.0, 0.0, 0.0))[..., :3] - A, 0, 1)
    has_spine = any(r == "spine" for r in roles.values())
    has_back = any(r == "back" for r in roles.values())
    if has_spine:
        print("Rendering: spines white…")
        S = np.clip(render(list(psd), viewport, fills(0.0, 1.0, 0.0))[..., :3] - A, 0, 1)
    if has_back:
        print("Rendering: backs white…")
        K = np.clip(render(list(psd), viewport, fills(0.0, 0.0, 1.0))[..., :3] - A, 0, 1)

    print("Building the UV maps…")
    uv = None
    uvb = None
    aspect = None
    for l in sos:
        if roles[l] == "spine":
            continue
        this, (sw, sh) = uv_map(l, viewport, alphas[l], args.scale)
        aspect = sw / sh
        if roles[l] == "cover":
            uv = this if uv is None else np.where((this[..., :1] >= 0), this, uv)
        else:
            uvb = this if uvb is None else np.where((this[..., :1] >= 0), this, uvb)
    if uv is None:
        sys.exit("No front cover Smart Object found")

    out_dir = os.path.join(args.out, args.id)
    os.makedirs(out_dir, exist_ok=True)
    ow, oh = uv.shape[1], uv.shape[0]

    def save_rgb(arr, name, quality=90):
        im = Image.fromarray((arr * 255).round().astype(np.uint8), "RGB").resize((ow, oh), Image.LANCZOS)
        im.save(os.path.join(out_dir, name), quality=quality, subsampling=0)

    # A cover that carries none of its colour through is a bake that replaced
    # nothing — the tell-tale of a Smart Object the render never reached.
    inside = uv[..., 0] >= 0
    from scipy import ndimage as ndi  # noqa: E402
    b_small = np.asarray(Image.fromarray((B * 255).astype(np.uint8)).resize((ow, oh)))
    carried = float(b_small[inside].mean() / 255) if inside.any() else 0.0
    print(f"cover colour carried through: {carried:.2f} (expect > 0.5)")
    if carried < 0.2:
        sys.exit("The cover Smart Object was not replaced — nothing of the cover reaches the output.")

    save_rgb(A, "a.jpg")
    save_rgb(B, "b.jpg")
    if has_spine:
        save_rgb(S, "s.jpg")
    if has_back:
        save_rgb(K, "k.jpg")
        Image.fromarray(encode_uv(uvb), "RGBA").save(os.path.join(out_dir, "uvb.png"), optimize=True)
    Image.fromarray(encode_uv(uv), "RGBA").save(os.path.join(out_dir, "uv.png"), optimize=True)

    # Where to look: the books, with air around them, as a 3:2 window. A
    # bought mockup is shot with room to crop into, and shown whole it is
    # mostly wall.
    union = np.zeros(alphas[sos[0]].shape, bool)
    for l in sos:
        union |= alphas[l] > 0.02
    ys, xs = np.where(union)
    x0, x1, y0, y1 = xs.min() * args.scale, xs.max() * args.scale, ys.min() * args.scale, ys.max() * args.scale
    bw, bh = x1 - x0, y1 - y0
    cw, ch = bw * 1.3, bh * 1.18
    if cw / ch < 1.5:
        cw = ch * 1.5
    else:
        ch = cw / 1.5
    cw, ch = min(cw, ow), min(ch, oh)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + bh * 0.03
    crop = {
        "x": int(round(min(max(0, cx - cw / 2), ow - cw))),
        "y": int(round(min(max(0, cy - ch / 2), oh - ch))),
        "width": int(round(cw)),
        "height": int(round(ch)),
    }

    manifest = {
        "id": args.id,
        "label": args.label,
        "width": ow,
        "height": oh,
        "back": has_back,
        "coverAspect": aspect,
        "crop": crop,
        "spine": has_spine,
        "source": os.path.basename(args.psd),
    }
    with open(os.path.join(out_dir, "template.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {out_dir}: {ow}×{oh}, cover aspect {aspect:.4f}, crop {crop}")

    if args.check:
        # The PSD's own designs through our maths, next to psd-tools' render.
        ours = A.copy()
        for l in sos:
            design = raster(l, viewport)
            if roles[l] == "cover":
                ours = ours + B * design[..., :3] * (alphas[l][..., None] > 0)
            elif roles[l] == "back":
                ours = ours + K * design[..., :3] * (alphas[l][..., None] > 0)
            else:
                ours = ours + S * design[..., :3] * (alphas[l][..., None] > 0)
        Image.fromarray((np.clip(ours, 0, 1) * 255).astype(np.uint8), "RGB").resize((ow, oh)).save(os.path.join(out_dir, "check-ours.jpg"), quality=85)
        ps = psd.composite(viewport=viewport).convert("RGB").resize((ow, oh))
        ps.save(os.path.join(out_dir, "check-photoshop.jpg"), quality=85)
        diff = np.abs(np.asarray(ps).astype(int) - np.asarray(Image.open(os.path.join(out_dir, "check-ours.jpg"))).astype(int)).max(2)
        print(f"check: mean diff {diff.mean():.2f}, px>20: {(diff > 20).mean() * 100:.2f}%")


if __name__ == "__main__":
    main()
