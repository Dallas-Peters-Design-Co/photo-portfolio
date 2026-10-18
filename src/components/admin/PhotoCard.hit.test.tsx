import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhotoSelectionResult } from "../../hooks/usePhotoSelection";
import type { Photo } from "../../types";
import { PhotoCard } from "./PhotoCard";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Every control on a photo card must be the thing under the pointer.
 *
 * The buttons are stacked down the card's right edge and the caption sits over
 * its foot. On a small card the bottom of the stack — Delete — ends up under
 * the caption, which then takes the click. Checked at the narrowest card the
 * grid draws, with every optional button showing.
 */

const PHOTO = {
  alt: "Dunes",
  category: "landscape",
  categoryId: "c1",
  categoryLabel: "Landscape",
  chromeUrl: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  exif: null,
  height: 1200,
  id: "p1",
  isFeatured: true,
  isPublished: false,
  lqip: null,
  order: 3,
  originalUrl: "https://x.test/original.jpg",
  showChrome: false,
  title: "Dunes at first light over the Llano Estacado",
  url: "https://x.test/p1.jpg",
  width: 900,
} as unknown as Photo;

const selection = {
  deletePhoto: vi.fn(() => Promise.resolve()),
  selectedIds: [],
  toggle: vi.fn(),
} as unknown as PhotoSelectionResult;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const noop = () => undefined;

describe("PhotoCard hit targets", () => {
  it.each([160, 180, 220, 300])(
    "every button takes its own click on a %ipx-wide card",
    async (width) => {
      host = document.createElement("div");
      host.style.width = `${width}px`;
      document.body.append(host);
      root = createRoot(host);
      await act(() => {
        root?.render(
          <PhotoCard
            isDragging={false}
            isNew={false}
            onDragEnd={noop}
            onDragOver={noop}
            onDragStart={noop}
            onEditDetails={noop}
            onEditImage={noop}
            onReset={noop}
            onRotate={noop}
            onToggleFeatured={noop}
            onTogglePublished={noop}
            photo={PHOTO}
            selection={selection}
          />
        );
      });
      const buttons = [
        ...(host.querySelectorAll<HTMLButtonElement>(
          ".photo-card__actions button"
        ) ?? []),
      ];
      expect(buttons.length).toBe(7);
      // One column: a wrapped second column lands on the select checkbox.
      expect(
        new Set(buttons.map((b) => b.getBoundingClientRect().left)).size
      ).toBe(1);
      for (const button of buttons) {
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2
        );
        expect(
          button.contains(hit),
          `${button.getAttribute("aria-label")} is covered by ${hit?.className}`
        ).toBe(true);
      }
    }
  );
});
