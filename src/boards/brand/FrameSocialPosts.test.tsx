import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { EMPTY_KIT, sanitizeKitDoc } from "../../../config/brandKit";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import { GuideSocialPosts } from "../../components/brandGuide/GuideSocialPosts";
import { type BrandKit, brandKitsApi } from "../../services/brandKitService";
import { boardsApi } from "../../services/portfolioService";
import type { Board, BoardItem } from "../../types";
import { ActiveBrandProvider, useActiveBrand } from "./ActiveBrand";
import { FrameSocialPosts } from "./FrameSocialPosts";

function Guide() {
  const kit = useActiveBrand()?.kit;
  return kit ? <GuideSocialPosts kit={kit} /> : null;
}

it("selects the same frame for three platforms and removes one placement", async () => {
  let kit: BrandKit = {
    createdAt: "",
    doc: EMPTY_KIT,
    id: "kit",
    inherited: [],
    name: "Studio",
    parentId: null,
    parentName: null,
    resolvedDoc: EMPTY_KIT,
    updatedAt: "",
    version: 1,
    versionCount: 1,
    versionId: "v1",
  };
  const frame: BoardItem = {
    ...BLANK_ITEM,
    body: "Launch artwork",
    height: 120,
    id: "frame",
    kind: "frame",
    width: 200,
    x: 0,
    y: 0,
    z: 0,
  };
  vi.spyOn(brandKitsApi, "list").mockImplementation(async () => [kit]);
  vi.spyOn(brandKitsApi, "get").mockImplementation(async () => kit);
  vi.spyOn(brandKitsApi, "save").mockImplementation((_, input) => {
    const doc = sanitizeKitDoc(input);
    kit = { ...kit, doc, resolvedDoc: doc };
    return Promise.resolve(kit);
  });
  vi.spyOn(boardsApi, "get").mockResolvedValue({
    id: "board",
    items: [frame],
  } as Board);
  localStorage.setItem("board-brand:board", "kit");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <MemoryRouter initialEntries={["/boards/board"]}>
            <Routes>
              <Route
                element={
                  <ActiveBrandProvider boardId="board">
                    <FrameSocialPosts item={frame} />
                    <Guide />
                  </ActiveBrandProvider>
                }
                path="/boards/:boardId"
              />
            </Routes>
          </MemoryRouter>
        </SWRConfig>
      )
    );
    const pick = async (name: string) => {
      await act(() =>
        page.getByRole("combobox", { name: "Brand guide social posts" }).click()
      );
      await act(() => page.getByRole("option", { exact: true, name }).click());
    };
    await pick("Add LinkedIn post");
    await pick("Add X (Twitter) post");
    await pick("Add Facebook post");
    await vi.waitFor(() =>
      expect(
        host.querySelectorAll('.social-mock__media img[alt="Launch artwork"]')
      ).toHaveLength(3)
    );
    expect(kit.doc.socialPosts.map((p) => p.platform)).toEqual([
      "linkedin-post",
      "x-post",
      "facebook-post",
    ]);
    expect(host.querySelector(".social-mock")?.textContent).toContain("Studio");
    await pick("Remove X (Twitter) post");
    await vi.waitFor(() =>
      expect(host.querySelectorAll("figure")).toHaveLength(2)
    );
  } finally {
    await act(() => root.unmount());
    host.remove();
    localStorage.removeItem("board-brand:board");
    vi.restoreAllMocks();
  }
});
