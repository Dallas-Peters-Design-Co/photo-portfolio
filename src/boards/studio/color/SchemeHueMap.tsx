import { hexToOklch } from "../../../lib/oklch";

const SIZE = 132;
const MID = SIZE / 2;
const RING = MID - 12;

/**
 * Where each colour sits round the hue wheel, and how vivid it is: further
 * from the middle is more chroma. Neutrals gather at the centre.
 */
export function HueMap({ colors }: { colors: string[] }) {
  const dots = colors
    .map((hex) => ({ hex, lch: hexToOklch(hex) }))
    .filter((d) => d.lch !== null);
  return (
    <svg
      aria-label="Hue map"
      className="studio-scheme__map"
      height={SIZE}
      role="img"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
    >
      <circle
        cx={MID}
        cy={MID}
        fill="none"
        opacity={0.25}
        r={RING}
        stroke="currentColor"
      />
      <circle cx={MID} cy={MID} fill="currentColor" opacity={0.25} r={1.5} />
      {dots.map(({ hex, lch }, i) => {
        const rad = (((lch?.h ?? 0) - 90) * Math.PI) / 180;
        // 0.3 is past the most vivid sRGB colours, so the ring is the limit.
        const r = RING * Math.min(1, (lch?.c ?? 0) / 0.3);
        return (
          <circle
            cx={MID + Math.cos(rad) * r}
            cy={MID + Math.sin(rad) * r}
            fill={hex}
            // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
            key={i}
            r={i === 0 ? 8 : 6}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
        );
      })}
    </svg>
  );
}
