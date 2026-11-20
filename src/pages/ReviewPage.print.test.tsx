import "../index.css";
import "../cms/PageContent.css";
import "./ReviewPage.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import { PageContent } from "../cms/PageContent";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const setPrintMedia = (media: "print" | "screen") => {
  const session = cdp() as unknown as {
    send: (method: string, params: { media: string }) => Promise<unknown>;
  };
  return session.send("Emulation.setEmulatedMedia", { media });
};

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
  document.documentElement.style.removeProperty("--foreground");
  await setPrintMedia("screen");
  root = null;
  host = null;
});

it("prints review intro rich text in dark ink on white paper", async () => {
  await setPrintMedia("print");
  document.documentElement.style.setProperty("--foreground", "#ffffff");
  host = document.createElement("div");
  host.className = "review-page";
  const intro = document.createElement("div");
  intro.className = "review-page__intro";
  host.append(intro);
  document.body.append(host);
  root = createRoot(intro);

  await act(() => {
    root?.render(
      <PageContent
        doc={{
          content: [
            {
              content: [{ text: "Opening paragraph", type: "text" }],
              type: "paragraph",
            },
            {
              attrs: { level: 2 },
              content: [{ text: "Opening heading", type: "text" }],
              type: "heading",
            },
            {
              content: [
                {
                  content: [
                    {
                      content: [{ text: "Opening list item", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "listItem",
                },
              ],
              type: "orderedList",
            },
          ],
          type: "doc",
        }}
      />
    );
  });

  const readableBlocks = intro.querySelectorAll(
    ".page-content__paragraph, .page-content__heading, .page-content__list"
  );
  expect(readableBlocks).toHaveLength(4);
  for (const block of readableBlocks) {
    expect(getComputedStyle(block).color).not.toBe("rgb(255, 255, 255)");
  }
  expect(getComputedStyle(host).backgroundColor).toBe("rgb(255, 255, 255)");
});
