import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit";
import type { BoardItem } from "../../types";
import { FrameOpenProvider } from "../FrameOpenContext";
import { ActiveBrandProvider } from "./ActiveBrand";
import { FrameLogoButton } from "./FrameLogoButton";

const existing = {
  clearSpace: 0,
  label: "Mark",
  minWidth: 0,
  rules: "",
  url: "https://blob.example.com/mark.svg",
};
const kit = {
  createdAt: "",
  doc: { ...EMPTY_KIT, logos: [existing] },
  id: "k1",
  inherited: [],
  name: "Pretext",
  parentId: null,
  parentName: null,
  resolvedDoc: { ...EMPTY_KIT, logos: [existing] },
  updatedAt: "",
  version: 1,
  versionCount: 1,
  versionId: "v1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = "";
});

it("adds a designed frame to the board brand's logos", async () => {
  const saved: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        saved.push(JSON.parse(String(init.body)));
      }
      return Promise.resolve(Response.json(init?.method ? kit : [kit]));
    })
  );
  localStorage.setItem("board-brand:b1", "k1");
  const frame = {
    body: "Wordmark",
    config: { designed: true },
    id: "f1",
    kind: "frame",
  } as unknown as BoardItem;
  const frameImage = vi.fn(() =>
    Promise.resolve({
      height: 200,
      url: "https://blob.example.com/frame.png",
      width: 600,
    })
  );
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ActiveBrandProvider boardId="b1">
        <FrameOpenProvider frameImage={frameImage}>
          <FrameLogoButton item={frame} />
        </FrameOpenProvider>
      </ActiveBrandProvider>
    )
  );
  await vi.waitFor(() => {
    expect(host.querySelector("button")?.textContent).toBe("Brand logo");
  });
  host.querySelector("button")?.click();
  await vi.waitFor(() => expect(saved).toHaveLength(1));
  expect(frameImage).toHaveBeenCalledWith("f1");
  const {
    doc: { logos },
  } = saved[0] as { doc: { logos: { label: string; url: string }[] } };
  expect(logos.map((l) => l.label)).toEqual(["Mark", "Wordmark"]);
  expect(logos[1]?.url).toBe("https://blob.example.com/frame.png");
});

it("shows nothing on a plain frame", () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <FrameOpenProvider frameImage={vi.fn()}>
        <FrameLogoButton
          item={
            { config: null, id: "f2", kind: "frame" } as unknown as BoardItem
          }
        />
      </FrameOpenProvider>
    )
  );
  expect(host.querySelector("button")).toBeNull();
});
