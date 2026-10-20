#!/usr/bin/env python3
"""
Generates the video model catalogue from fal's own catalogue and schemas.

Two outputs, both read from the source rather than remembered:

  config/nodes/falVideoInputs.generated.ts — for each video endpoint, which of
    its fields a Video node's ports fill: the start frame, the end frame, a list
    of reference pictures, a source clip, and whether it takes a prompt. The
    endpoints disagree about every one of these names — Kling v3 says
    `start_image_url`, Veo says `image_url`, Seedance says `first_frame_url` —
    and a field an endpoint has never heard of is a 422 after the bill.

  db/patches/044_all_video_models.sql — a row per endpoint, so every one of them
    can be picked on the node. Data only: ON CONFLICT DO NOTHING, no schema
    change, so it can run before or after a deploy.

An endpoint is left out when it requires something the node cannot send — a
LoRA list, a voice id, a mask clip, an audio track. Offering it would be a
choice that is refused every time it is made.

Run it, then run scripts/fetch-fal-params.py so the Seconds menu knows the new
endpoints' durations. Schemas are cached in /tmp/falschema between runs.
"""

import collections
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_TS = ROOT / "config" / "nodes" / "falVideoInputs.generated.ts"
OUT_SQL = ROOT / "db" / "patches" / "044_all_video_models.sql"
CATALOGUE = "https://api.fal.ai/v1/models?category={}&limit=100&status=active"
SCHEMA = "https://fal.ai/api/openapi/queue/openapi.json?endpoint_id="
CACHE = pathlib.Path("/tmp/falschema")
UA = {"User-Agent": "Mozilla/5.0"}
CATEGORIES = ("image-to-video", "text-to-video", "video-to-video")

# Which schema fields each port fills, in order of preference.
SINGLE = {
    "image": ("image_url", "start_image_url", "first_frame_url", "first_image_url",
              "first_frame_image_url", "source_image_url"),
    "end": ("end_image_url", "last_frame_url", "tail_image_url"),
    "video": ("video_url", "source_video_url"),
}
LISTS = {
    "references": ("image_urls", "reference_image_urls", "ref_image_urls", "input_image_urls"),
}
# The names the models_image_param CHECK allows; anything else stores image_url.
IMAGE_PARAMS = ("image_url", "image_urls", "start_image_url", "video_url")
MAX_LABEL = 60
# Rows per INSERT; the migration checker looks 80 lines ahead for ON CONFLICT.
BATCH = 50


def fetch(url: str) -> dict:
    """GET as JSON, waiting out fal's rate limit rather than dying on it."""
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == 5:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def catalogue() -> list[tuple[str, str, str]]:
    """Every active video endpoint, as (id, category, display name)."""
    CACHE.mkdir(exist_ok=True)
    cached = CACHE / "_catalogue.json"
    if cached.exists():
        return [tuple(row) for row in json.loads(cached.read_text())]
    rows = fetch_catalogue()
    cached.write_text(json.dumps(rows))
    return rows


def fetch_catalogue() -> list[tuple[str, str, str]]:
    found: dict[str, tuple[str, str, str]] = {}
    for category in CATEGORIES:
        cursor = None
        while True:
            url = CATALOGUE.format(category)
            if cursor:
                url += "&cursor=" + urllib.parse.quote(cursor)
            page = fetch(url)
            for model in page.get("models") or []:
                meta = model.get("metadata") or {}
                found.setdefault(model["endpoint_id"], (
                    model["endpoint_id"], meta.get("category", category),
                    (meta.get("display_name") or model["endpoint_id"]).strip()))
            cursor = page.get("next_cursor")
            if not (page.get("has_more") and cursor):
                break
    return sorted(found.values())


def schema_for(endpoint: str) -> dict:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / (endpoint.replace("/", "__") + ".json")
    if path.exists():
        return json.loads(path.read_text())
    data = fetch(SCHEMA + urllib.parse.quote(endpoint, safe="/"))
    path.write_text(json.dumps(data))
    return data


def input_component(schema: dict) -> dict:
    """The schema the POST body is declared against — not every *Input* merged."""
    components = schema.get("components", {}).get("schemas") or {}
    for ops in (schema.get("paths") or {}).values():
        ref = (((ops.get("post") or {}).get("requestBody") or {})
               .get("content", {}).get("application/json", {})
               .get("schema", {}).get("$ref"))
        if ref:
            return components.get(ref.split("/")[-1]) or {}
    return {}


def branches(spec: dict) -> list[dict]:
    return [spec, *(b for b in (spec.get("anyOf") or []) if isinstance(b, dict))]


def is_string_list(spec: dict) -> "tuple[bool, int | None]":
    for branch in branches(spec):
        if branch.get("type") == "array":
            items = branch.get("items") or {}
            if items.get("type") == "string":
                return True, branch.get("maxItems")
    return False, None


def is_string(spec: dict) -> bool:
    return any(b.get("type") == "string" for b in branches(spec))


def map_inputs(component: dict) -> "tuple[dict | None, str]":
    """The node's view of an endpoint, or None and why it cannot be driven."""
    props = component.get("properties") or {}
    required = set(component.get("required") or [])
    slots: dict[str, dict] = {}
    used: set[str] = set()
    for slot, names in SINGLE.items():
        for name in names:
            if name in props and is_string(props[name]):
                slots[slot] = {"field": name, "list": False, "required": name in required}
                used.add(name)
                break
    for slot, names in LISTS.items():
        for name in names:
            if name not in props:
                continue
            ok, most = is_string_list(props[name])
            if ok:
                entry = {"field": name, "list": True, "required": name in required}
                if isinstance(most, int):
                    entry["max"] = most
                slots[slot] = entry
                used.add(name)
                break
    if "prompt" in props:
        prompt = "required" if "prompt" in required else "optional"
        used.add("prompt")
    else:
        prompt = "none"
    unmet = sorted(f for f in required - used if "default" not in (props.get(f) or {}))
    if unmet:
        return None, ",".join(unmet)
    if prompt == "none" and not slots:
        return None, "(nothing the node can send)"
    return {"prompt": prompt, "slots": slots}, ""


def input_shape(inputs: dict) -> str:
    """The models.input value, within the models_input CHECK."""
    slots = inputs["slots"]
    takes_prompt = inputs["prompt"] != "none"
    if slots.get("video", {}).get("required"):
        return "prompt-and-video" if takes_prompt else "video"
    if any(s["required"] for k, s in slots.items() if k != "video"):
        return "prompt-and-image" if takes_prompt else "image"
    return "prompt"


def image_param(inputs: dict) -> str:
    for slot in ("image", "references", "video"):
        field = inputs["slots"].get(slot, {}).get("field")
        if field in IMAGE_PARAMS:
            return field
    return "image_url"


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def labels_for(rows: list[tuple[str, str, str]]) -> dict[str, str]:
    """Display names, made distinct: fal gives three endpoints one name."""
    counts = collections.Counter(name for _, _, name in rows)
    out: dict[str, str] = {}
    for endpoint, _, name in rows:
        label = name
        if counts[name] > 1:
            tail = endpoint.split("/")[-1].replace("-", " ")
            label = f"{name} · {tail}"
        out[endpoint] = label[:MAX_LABEL].strip()
    return out


def main() -> int:
    rows = catalogue()
    table: dict[str, dict] = {}
    kept: list[tuple[str, str, str]] = []
    reasons: collections.Counter = collections.Counter()
    for endpoint, category, name in rows:
        try:
            component = input_component(schema_for(endpoint))
        except Exception as err:  # noqa: BLE001 - one dead endpoint must not stop the rest
            reasons[f"schema unavailable ({err})"] += 1
            continue
        inputs, why = map_inputs(component)
        if inputs is None:
            for field in why.split(","):
                reasons[field] += 1
            continue
        table[endpoint] = inputs
        kept.append((endpoint, category, name))

    if not table:
        print("No schemas read — fal's catalogue or OpenAPI route has changed.", file=sys.stderr)
        return 1

    write_ts(table)
    write_sql(kept, table)
    print(f"{len(kept)} included, {len(rows) - len(kept)} excluded of {len(rows)}")
    for reason, count in reasons.most_common(15):
        print(f"  {count:4}  {reason}")
    return 0


def write_ts(table: dict) -> None:
    # One endpoint per line: 400 of them pretty-printed is four thousand lines.
    lines = ",\n".join(
        f"  {json.dumps(k)}: {json.dumps(v, sort_keys=True)}"
        for k, v in sorted(table.items()))
    body = "{\n" + lines + "\n}"
    OUT_TS.write_text(f'''/**
 * Which fields each fal video endpoint fills from a Video node's ports.
 *
 * GENERATED by scripts/fetch-fal-video-models.py. Do not edit by hand.
 *
 * The endpoints agree on nothing here: the start frame is `image_url` on Veo,
 * `start_image_url` on Kling v3 and `first_frame_url` elsewhere, and a list of
 * reference pictures has four names. A field an endpoint has never heard of is
 * a 422 on a request that has already been billed, so the names are read from
 * fal's own schemas.
 *
 * An endpoint absent here falls back to its row's `image_param`.
 */

export type FalVideoSlot = "image" | "end" | "references" | "video";

export interface FalVideoField {{
  field: string;
  list: boolean;
  /** The most items a list slot takes, where the schema says. */
  max?: number;
  required: boolean;
}}

export interface FalVideoInputs {{
  prompt: "required" | "optional" | "none";
  slots: Partial<Record<FalVideoSlot, FalVideoField>>;
}}

export const FAL_VIDEO_INPUTS: Readonly<Record<string, FalVideoInputs>> =
  {body} as const;
''')


def write_sql(kept: list[tuple[str, str, str]], table: dict) -> None:
    labels = labels_for(kept)
    order = {c: i for i, c in enumerate(CATEGORIES)}
    ordered = sorted(kept, key=lambda r: (order.get(r[1], 9), r[0]))
    values = []
    for index, (endpoint, _, _) in enumerate(ordered):
        inputs = table[endpoint]
        values.append(
            f"  ({sql_text(endpoint)}, {sql_text(labels[endpoint])}, "
            f"{sql_text(input_shape(inputs))}, {sql_text(image_param(inputs))}, "
            f"'video', FALSE, TRUE, {200 + index})")
    OUT_SQL.write_text(
        "-- Every fal video endpoint a Video node can drive.\n"
        "--\n"
        "-- GENERATED by scripts/fetch-fal-video-models.py from fal's own catalogue.\n"
        "-- Image-to-video, text-to-video and video-to-video, minus the endpoints\n"
        "-- that require something the node cannot send (a LoRA list, a voice, a\n"
        "-- mask clip, an audio track).\n"
        "--\n"
        "-- Data only, and idempotent: ON CONFLICT DO NOTHING, so a row an admin has\n"
        "-- since edited or switched off is left exactly as they left it, and the\n"
        "-- fourteen seeded by 027 keep their labels and order. Which field each\n"
        "-- port fills is not stored here — see config/nodes/falVideoInputs.generated.ts.\n"
        "--\n"
        "-- In batches, so scripts/check-migrations.ts finds each ON CONFLICT near\n"
        "-- its INSERT.\n"
        "\n"
        + "\n\n".join(
            "INSERT INTO models (id, label, input, image_param, output, vector, enabled, sort_order)\n"
            "VALUES\n" + ",\n".join(values[i:i + BATCH]) + "\nON CONFLICT (id) DO NOTHING;"
            for i in range(0, len(values), BATCH)) + "\n")


if __name__ == "__main__":
    sys.exit(main())
