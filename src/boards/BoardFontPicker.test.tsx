import "../index.css";
import { type ReactElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogFont, FontshareFont } from "../../config/fontRef";
import { normalizeTextStyle, textStyleCss } from "../../config/textStyle";
import { BLANK_ITEM } from "../components/admin/boardEditor/placement";
import { brandKitsApi } from "../services/brandKitService";
import {
  loadFontPreview,
  loadFontRef,
  loadFontsharePreview,
} from "../theme/remoteFonts";
import type { BoardItem } from "../types";
import { BoardFontPicker } from "./BoardFontPicker";
import { BoardTextTools } from "./BoardTextTools";
import { TextControls } from "./creative/ContextBar";

vi.mock("../theme/fonts", () => ({ loadFont: vi.fn(() => Promise.resolve()) }));
vi.mock("../theme/remoteFonts", () => ({
  loadFontPreview: vi.fn(),
  loadFontRef: vi.fn(
    (value: unknown) => typeof value === "string" && value.includes(":")
  ),
  loadFontRefReady: vi.fn(() => Promise.resolve(true)),
  loadFontsharePreview: vi.fn(),
}));

const catalogFont = (family: string): CatalogFont => ({
  category: "sans",
  family,
  italic: true,
  rank: 0,
  variable: true,
  weights: [400, 700],
});
const googleFonts = Array.from({ length: 90 }, (_, index) =>
  catalogFont(`Google Sample ${index}`)
);
googleFonts.push(catalogFont("Zilla Slab"));
const fontshareFonts: FontshareFont[] = Array.from(
  { length: 50 },
  (_, index) => ({
    ...catalogFont(`Fontshare Sample ${index}`),
    licenseType: "ITF FFL",
    slug: `sample-${index}`,
  })
);
fontshareFonts.push({
  ...catalogFont("Satoshi"),
  licenseType: "ITF FFL",
  slug: "satoshi",
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let latest: BoardItem;

const flush = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
const mount = async (ui: ReactElement) => {
  host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:24px;top:400px;width:480px;height:90px";
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <SWRConfig
      value={{
        dedupingInterval: 0,
        errorRetryCount: 0,
        provider: () => new Map(),
      }}
    >
      {ui}
    </SWRConfig>
  );
  await flush();
  return host;
};
const button = (label: string, container: ParentNode = document) => {
  const found = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((element) => element.textContent?.trim() === label);
  if (!found) {
    throw new Error(`Missing button: ${label}`);
  }
  return found;
};
const open = async () => {
  host?.querySelector<HTMLButtonElement>('[aria-label="Font"]')?.click();
  await vi.waitFor(() => expect(brandKitsApi.googleFonts).toHaveBeenCalled());
  await vi.waitFor(() =>
    expect(brandKitsApi.fontshareFonts).toHaveBeenCalled()
  );
  await flush();
};
const search = async (query: string) => {
  const input = document.querySelector<HTMLInputElement>(
    '[aria-label="Search fonts"]'
  );
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  if (!(input && setter)) {
    throw new Error("Missing font search");
  }
  setter.call(input, query);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  return input;
};

function TextHarness({
  frame = false,
  family = null,
}: {
  family?: string | null;
  frame?: boolean;
}) {
  const [item, setItem] = useState<BoardItem>({
    ...BLANK_ITEM,
    body: "Hello",
    height: 90,
    id: "text",
    kind: "text",
    textStyle: normalizeTextStyle({ color: "#123456", family, weight: 700 }),
    width: 480,
    x: 0,
    y: 0,
    z: 1,
  });
  latest = item;
  const onPatch = (patch: Partial<BoardItem>) =>
    setItem((current) => ({ ...current, ...patch }));
  if (frame) {
    return <TextControls item={item} onPatch={onPatch} />;
  }
  return (
    <BoardTextTools
      anchor={{ current: host }}
      chromeScale={{ transform: "scale(1)" }}
      item={item}
      onPatch={onPatch}
    />
  );
}

beforeEach(() => {
  vi.spyOn(brandKitsApi, "googleFonts").mockResolvedValue(googleFonts);
  vi.spyOn(brandKitsApi, "fontshareFonts").mockResolvedValue(fontshareFonts);
});
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("board font catalogs", () => {
  it("searches the entire Google catalog and stores the chosen font on board text", async () => {
    await mount(<TextHarness />);
    expect(brandKitsApi.googleFonts).not.toHaveBeenCalled();
    await open();
    const input = await search("zilla");
    expect(loadFontPreview).toHaveBeenCalledWith("Zilla Slab");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
    );
    await flush();
    expect(latest.textStyle?.family).toBe("g:Zilla Slab");
    expect(latest.textStyle?.color).toBe("#123456");
    expect(textStyleCss(latest).fontFamily).toContain('"Zilla Slab"');
    expect(loadFontRef).toHaveBeenCalledWith("g:Zilla Slab");
    expect(host?.querySelector('[aria-label="Font"]')?.textContent).toContain(
      "Zilla Slab"
    );
  });

  it("uses the same full Fontshare catalog for frame text", async () => {
    await mount(<TextHarness frame />);
    await open();
    button("Fontshare").click();
    await search("satoshi");
    expect(loadFontsharePreview).toHaveBeenCalledWith("satoshi", 400);
    button("SatoshiFontshare").click();
    await flush();
    expect(latest.textStyle?.family).toBe("f:satoshi:Satoshi");
    expect(textStyleCss(latest).fontFamily).toContain('"Satoshi"');
  });

  it("lets browsing reach fonts beyond the first page", async () => {
    await mount(<BoardFontPicker onChange={() => undefined} value={null} />);
    await open();
    button("Google Fonts").click();
    await flush();
    expect(document.querySelectorAll("[data-font-option]")).toHaveLength(40);
    button("Show more fonts (51)").click();
    await flush();
    expect(document.querySelectorAll("[data-font-option]")).toHaveLength(80);
    button("Show more fonts (11)").click();
    await flush();
    expect(button("Zilla SlabGoogle Fonts")).toBeTruthy();
  });

  it("shows a saved remote selection before opening or loading the catalog", async () => {
    await mount(
      <BoardFontPicker onChange={() => undefined} value="f:satoshi:Satoshi" />
    );
    expect(host?.textContent).toContain("Satoshi");
    expect(brandKitsApi.googleFonts).not.toHaveBeenCalled();
    expect(brandKitsApi.fontshareFonts).not.toHaveBeenCalled();
  });

  it("can return to the board default without losing the other type settings", async () => {
    await mount(<TextHarness family="g:Zilla Slab" />);
    await open();
    await search("Board default");
    button("Board defaultBoard").click();
    await flush();
    expect(latest.textStyle).toMatchObject({
      color: "#123456",
      family: null,
      weight: 700,
    });
  });
});
