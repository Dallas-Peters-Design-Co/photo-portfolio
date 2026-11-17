import "../../index.css";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit";
import { ActiveBrandProvider } from "../brand/ActiveBrand";
import { SocialPreview } from "./SocialPreview";
import { avatarLogo } from "./socialBrand";

const LOGO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')}`;

const logo = (label: string, url: string) => ({
  clearSpace: 0,
  label,
  minWidth: 0,
  rules: "",
  url,
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = "";
});

it("picks a mark that reads on white over a reversed logo", () => {
  expect(
    avatarLogo([
      logo("Color on dark", "a"),
      logo("Wordmark", "b"),
      logo("Mark", "c"),
    ])
  ).toBe("c");
  expect(avatarLogo([logo("White", "a")])).toBe("a");
  expect(avatarLogo([])).toBeNull();
});

it("shows the board's brand on a social mock-up", async () => {
  const kit = {
    createdAt: "",
    doc: EMPTY_KIT,
    id: "k1",
    inherited: [],
    name: "RoleModel Software",
    parentId: null,
    parentName: null,
    resolvedDoc: {
      ...EMPTY_KIT,
      logos: [logo("Mark", LOGO)],
      websites: ["https://www.rolemodelsoftware.com"],
    },
    updatedAt: "",
    version: 1,
    versionCount: 1,
    versionId: "v1",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json([kit])))
  );
  localStorage.setItem("board-brand:b1", "k1");
  const host = document.createElement("div");
  host.style.cssText = "width:300px;height:400px";
  document.body.append(host);
  createRoot(host).render(
    <ActiveBrandProvider boardId="b1">
      <SocialPreview platform="x-post">
        <div />
      </SocialPreview>
      <SocialPreview platform="linkedin-page">
        <div />
      </SocialPreview>
    </ActiveBrandProvider>
  );
  await vi.waitFor(() => {
    expect(host.textContent).toContain("RoleModel Software");
  });
  expect(host.textContent).toContain("@rolemodelsoftware");
  expect(host.textContent).not.toContain("Your Company");
  expect(host.querySelectorAll("img.social-mock__mark").length).toBeGreaterThan(
    1
  );
});
