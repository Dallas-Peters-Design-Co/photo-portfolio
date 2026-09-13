import { fitted, ground } from "./drawMark";
import type { ProofTile } from "./proofTiles";

/**
 * The mark where it meets real information.
 *
 * Every other tile puts the mark on a surface and asks whether it survives.
 * These two ask something harder: whether it still works with *words* beside
 * it — a name, an address, a row of contact details set at the size they are
 * really printed. A mark that needs the whole field to itself fails here and
 * nowhere else on the sheet.
 */

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export interface StationeryContext {
  mark: CanvasImageSource & { height: number; width: number };
  name: string;
  tile: ProofTile;
}

/**
 * A card at its real proportion, with a real block of information on it.
 *
 * The first version put the mark in a corner and the brand name underneath and
 * stopped, which tests nothing — a card is the one place a mark is crowded, and
 * a card with nothing on it is just a smaller white tile.
 *
 * The details are obvious placeholders. Real-looking invented ones would be
 * read as a mistake by whoever it is shown to; asterisks and YOUR NAME cannot
 * be.
 */
export const drawCard = (
  ctx: CanvasRenderingContext2D,
  size: number,
  { mark, name }: StationeryContext
): void => {
  ground(ctx, "#efeeec", { height: size, width: size });

  // 3.5 x 2 inches — the one physical size everybody already knows by eye.
  const width = size * 0.78;
  const height = (width / 3.5) * 2;
  const left = (size - width) / 2;
  const top = (size - height) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 6);
  ctx.fill();
  ctx.restore();

  const pad = width * 0.09;
  const box = fitted(mark, {
    height: height * 0.2,
    width: width * 0.34,
    x: left + pad,
    y: top + pad,
  });
  ctx.drawImage(mark, box.x, box.y, box.width, box.height);

  /*
   * A hairline above the details.
   *
   * Not decoration: it is where a card's information block begins, and without
   * it the mark and the type read as one drifting group rather than as two
   * things with a card between them.
   */
  const ruleY = top + height - pad * 2.1;
  ctx.strokeStyle = "#e2e0dd";
  ctx.beginPath();
  ctx.moveTo(left + pad, ruleY);
  ctx.lineTo(left + width - pad, ruleY);
  ctx.stroke();

  const rows: [string, string][] = [
    ["YOUR NAME", "#1a1a1a"],
    [name.toUpperCase() || "THE BRAND", "#8a8a8a"],
  ];
  ctx.font = `${Math.round(size * 0.017)}px ${MONO}`;
  ctx.textBaseline = "top";
  rows.forEach(([text, colour], index) => {
    ctx.fillStyle = colour;
    ctx.fillText(text, left + pad, ruleY + pad * 0.4 + index * size * 0.026);
  });

  ctx.fillStyle = "#a8a6a3";
  ctx.textAlign = "right";
  ctx.fillText("you@example.com", left + width - pad, ruleY + pad * 0.4);
  ctx.fillText(
    "000 000 ****",
    left + width - pad,
    ruleY + pad * 0.4 + size * 0.026
  );
  ctx.textAlign = "left";
};

/**
 * The mark in a browser tab, and at the three sizes a favicon is served at.
 *
 * The scale tile already shows a mark at 16 pixels on its own. This shows it
 * where 16 pixels actually happens: beside a truncated title, next to three
 * other tabs, at the size a person glances at rather than inspects. Marks that
 * pass the scale ramp still fail here, because the ramp gives them a white
 * field and a tab gives them company.
 */
const FAVICON_SIZES = [16, 32, 48];

export const drawFavicon = (
  ctx: CanvasRenderingContext2D,
  size: number,
  { mark, name }: StationeryContext
): void => {
  ground(ctx, "#2b2b2d", { height: size, width: size });

  const chromeW = size * 0.82;
  const chromeH = size * 0.42;
  const left = (size - chromeW) / 2;
  const top = size * 0.16;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#f4f4f6";
  ctx.beginPath();
  ctx.roundRect(left, top, chromeW, chromeH, 10);
  ctx.fill();
  ctx.restore();

  // The three dots, which is what makes it read as a window at a glance.
  const dots = ["#ff5f57", "#febc2e", "#28c840"];
  dots.forEach((colour, index) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(
      left + size * 0.035 + index * size * 0.028,
      top + size * 0.04,
      size * 0.009,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  // One active tab carrying the mark, and a neighbour on each side so the
  // comparison is against something rather than against nothing.
  const tabW = chromeW * 0.3;
  const tabY = top + size * 0.075;
  const tabH = size * 0.055;
  for (let index = 0; index < 3; index += 1) {
    const tabX = left + size * 0.02 + index * (tabW + 4);
    ctx.fillStyle = index === 1 ? "#ffffff" : "#e6e6ea";
    ctx.beginPath();
    ctx.roundRect(tabX, tabY, tabW, tabH, 6);
    ctx.fill();
    const icon = 16;
    const box = fitted(mark, {
      height: icon,
      width: icon,
      x: tabX + 8,
      y: tabY + (tabH - icon) / 2,
    });
    if (index === 1) {
      ctx.drawImage(mark, box.x, box.y, box.width, box.height);
    } else {
      ctx.fillStyle = "#c9c9cf";
      ctx.fillRect(box.x, box.y, icon, icon);
    }
    ctx.fillStyle = index === 1 ? "#1a1a1a" : "#9a9aa2";
    ctx.font = `${Math.round(size * 0.019)}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(
      index === 1 ? `${name.slice(0, 9)}…` : "…",
      box.x + icon + 7,
      tabY + tabH / 2
    );
  }

  // The three served sizes, laid out below, each on the white a browser
  // actually composites a favicon onto.
  let x = left + size * 0.08;
  const row = top + chromeH + size * 0.12;
  for (const px of FAVICON_SIZES) {
    const plate = px + 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, row + (64 - plate) / 2, plate, plate, 4);
    ctx.fill();
    const box = fitted(mark, {
      height: px,
      width: px,
      x: x + 8,
      y: row + (64 - plate) / 2 + 8,
    });
    ctx.drawImage(mark, box.x, box.y, box.width, box.height);
    ctx.fillStyle = "#8a8a90";
    ctx.font = `${Math.round(size * 0.016)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(`${px} PX`, x + plate / 2, row + 78);
    ctx.textAlign = "left";
    x += plate + size * 0.06;
  }
};

/**
 * The mark on three photographs it did not choose.
 *
 * Panels rather than one image, because the comparison *is* the tile: the same
 * mark at the same size against dark, light and colour, side by side, where a
 * weakness shows as a difference rather than as a feeling.
 *
 * The mark is drawn as it is, with no plate behind it and no recolouring. A
 * plate would be the answer to the question this tile asks, and answering it
 * here would mean the sheet never asks it.
 */
export const drawOnPhoto = (
  ctx: CanvasRenderingContext2D,
  size: number,
  mark: CanvasImageSource & { height: number; width: number },
  grounds: { credit: string; image: CanvasImageSource; label: string }[]
): void => {
  ground(ctx, "#1b1b1e", { height: size, width: size });
  if (grounds.length === 0) {
    ctx.fillStyle = "#8a8a8a";
    ctx.font = `${Math.round(size * 0.022)}px ${MONO}`;
    ctx.fillText("No photographs could be fetched", size * 0.08, size * 0.5);
    return;
  }

  const pad = size * 0.04;
  const panelW = (size - pad * (grounds.length + 1)) / grounds.length;
  const panelH = size - pad * 2 - size * 0.06;

  grounds.forEach((entry, index) => {
    const x = pad + index * (panelW + pad);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, pad, panelW, panelH, 6);
    ctx.clip();
    // Covered rather than fitted: a photograph with letterboxing around it is
    // a picture of a photograph, not a surface the mark is sitting on.
    const source = entry.image as { height: number; width: number };
    const scale = Math.max(panelW / source.width, panelH / source.height);
    ctx.drawImage(
      entry.image,
      x + (panelW - source.width * scale) / 2,
      pad + (panelH - source.height * scale) / 2,
      source.width * scale,
      source.height * scale
    );
    const box = fitted(mark, {
      height: panelH * 0.22,
      width: panelW * 0.62,
      x: x + panelW * 0.19,
      y: pad + panelH * 0.39,
    });
    ctx.drawImage(mark, box.x, box.y, box.width, box.height);
    ctx.restore();

    ctx.fillStyle = "#9a9a9a";
    ctx.font = `${Math.round(size * 0.016)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(entry.label.toUpperCase(), x + panelW / 2, size - pad * 1.2);
    ctx.textAlign = "left";
  });
};
