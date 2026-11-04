import { type Fit, tintCss } from "./imageAnchor";

/**
 * A picture drawn in one colour: the colour, masked by the picture, so its
 * shape (and anything see-through) is kept. Takes the place of the <img>
 * wherever a picture layer has a tint (imageAnchor.tintOf).
 */
export function TintedPicture({
  className,
  fit,
  position,
  radius,
  tint,
  url,
}: {
  className?: string;
  fit: Fit;
  position?: string;
  radius?: number;
  tint: string;
  url: string;
}) {
  const css = tintCss(url, tint, fit, position ?? "center");
  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundColor: css["background-color"],
        borderRadius: radius && radius > 0 ? radius : undefined,
        height: "100%",
        mask: css.mask,
        WebkitMask: css["-webkit-mask"],
        width: "100%",
      }}
    />
  );
}
