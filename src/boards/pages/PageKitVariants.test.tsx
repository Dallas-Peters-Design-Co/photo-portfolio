import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import { type BrandKit, brandKitsApi } from "../../services/brandKitService";
import { ActiveBrandProvider } from "../brand/ActiveBrand";
import { PageCanvasEditor } from "./PageCanvasEditor";
import { frame } from "./pageCanvasTestHarness";

it("shows newly saved cards in the Card dropdown and inserts the selected variant", async () => {
  const id = "12345678-1234-1234-1234-123456789012";
  const base: ConceptStyle[] = [
    { id: "plain", kind: "card", look: {}, name: "Plain" },
    { id: "button", kind: "button", look: {}, name: "Primary" },
    { id: "results", kind: "card", look: {}, name: "Study Results" },
  ];
  const withStyles = (styles: ConceptStyle[]): BrandKit => ({
    createdAt: "",
    doc: { ...EMPTY_KIT, componentStyles: styles },
    id,
    inherited: [],
    name: "Pretex[t]",
    parentId: null,
    parentName: null,
    resolvedDoc: { ...EMPTY_KIT, componentStyles: styles },
    updatedAt: "",
    version: 1,
    versionCount: 1,
    versionId: null,
  });
  const list = vi
    .spyOn(brandKitsApi, "list")
    .mockResolvedValue([withStyles(base)]);
  const key = "board-brand:variant-test";
  localStorage.setItem(key, id);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let saved: PageDesign | undefined;
  function Editor() {
    const [design, setDesign] = useState<PageDesign>();
    return (
      <PageCanvasEditor
        frame={{ ...frame, config: design ? { pageDesign: design } : null }}
        onChange={(next) => {
          saved = next;
          setDesign(next);
        }}
        onClose={() => undefined}
      />
    );
  }
  try {
    await act(() =>
      root.render(
        <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
          <ActiveBrandProvider boardId="variant-test">
            <Editor />
          </ActiveBrandProvider>
        </SWRConfig>
      )
    );
    const card = page.getByRole("combobox", { exact: true, name: "Card" });
    await expect.element(card).toHaveTextContent("Plain");
    expect(host.querySelectorAll(".page-builder__variant")).toHaveLength(2);
    const signIn: ConceptStyle = {
      id: "sign-in",
      kind: "card",
      look: {
        cardBody: "Welcome back.",
        contents: {
          body: {
            elements: [
              { ...createConceptElement("input"), placeholder: "Email" },
            ],
          },
        },
      },
      name: "Sign in to Pretext",
    };
    list.mockResolvedValue([withStyles([...base, signIn])]);
    await card.click();
    await page.getByRole("option", { exact: true, name: signIn.name }).click();
    expect(saved).toBeUndefined();
    await page
      .getByRole("button", { name: "Insert Sign in to Pretext (Card)" })
      .click();
    expect(saved?.concept.elements[0]).toMatchObject({
      kind: "card",
      slots: { body: { elements: [{ kind: "input", placeholder: "Email" }] } },
      styleId: signIn.id,
      text: "Sign in to Pretext\nWelcome back.",
    });
  } finally {
    await act(() => root.unmount());
    host.remove();
    localStorage.removeItem(key);
    list.mockRestore();
  }
});
