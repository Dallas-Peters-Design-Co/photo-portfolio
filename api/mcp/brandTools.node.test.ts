import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../config/brandKit.js";
import type { BrandKitDto } from "../_lib/brandKitStore.js";

const kits: BrandKitDto[] = [];
const writes: { doc: unknown; kitId: string }[] = [];

vi.mock("../_lib/brandKitStore.js", () => ({
  loadKit: (_sql: unknown, id: string) =>
    Promise.resolve(kits.find((k) => k.id === id) ?? null),
  loadKits: () => Promise.resolve(kits),
  writeKitVersion: (_sql: unknown, kitId: string, doc: unknown) => {
    writes.push({ doc, kitId });
    return Promise.resolve({ id: "v", version: writes.length + 1 });
  },
}));

const { BRAND_TOOLS } = await import("../_lib/mcpBrandTools.js");
const { SITE_TOOLS } = await import("../_lib/mcpTools.js");
const tool = (name: string) => {
  const found = BRAND_TOOLS.find((t) => t.name === name);
  if (!found) {
    throw new Error(name);
  }
  return found;
};
const ctx = { sql: {} as never };

const kit = (
  id: string,
  name: string,
  over: Partial<BrandKitDto> = {}
): BrandKitDto =>
  ({
    createdAt: "2026-10-01T00:00:00.000Z",
    doc: { ...EMPTY_KIT },
    id,
    inherited: [],
    name,
    parentId: null,
    parentName: null,
    resolvedDoc: {
      ...EMPTY_KIT,
      palette: [{ name: "Forest", role: "primary", value: "#1f4d3a" }],
    },
    updatedAt: "2026-10-01T00:00:00.000Z",
    version: 1,
    versionCount: 1,
    versionId: "v1",
    ...over,
  }) as BrandKitDto;

beforeEach(() => {
  kits.length = 0;
  writes.length = 0;
  kits.push(
    kit("11111111-1111-1111-1111-111111111111", "Bird Creek Roofing"),
    kit("22222222-2222-2222-2222-222222222222", "TSRP"),
    kit("33333333-3333-3333-3333-333333333333", "TSRP Solar")
  );
});

describe("brand tools on the connector", () => {
  it("are registered, with the writes marked", () => {
    const names = SITE_TOOLS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_brand_kits",
        "get_brand_kit",
        "add_brand_reference",
        "remove_brand_reference",
        "get_design_md",
        "set_brand_palette",
      ])
    );
    expect(tool("add_brand_reference").writes).toBe(true);
    expect(tool("get_brand_kit").writes).toBeFalsy();
  });

  it("finds a kit by name, exact match first, then prefix", async () => {
    const out = (await tool("get_brand_kit").run({ kit: "bird" }, ctx)) as {
      name: string;
      brand: { palette: unknown[] };
    };
    expect(out.name).toBe("Bird Creek Roofing");
    expect(out.brand.palette).toHaveLength(1);
    expect(
      (
        (await tool("get_brand_kit").run({ kit: "tsrp" }, ctx)) as {
          name: string;
        }
      ).name
    ).toBe("TSRP");
  });

  it("explains an unknown or ambiguous kit", async () => {
    await expect(
      tool("get_brand_kit").run({ kit: "Viaskai" }, ctx)
    ).rejects.toThrow("No brand kit called");
    kits.splice(1, 1);
    await expect(
      tool("get_brand_kit").run({ kit: "TSR" }, ctx)
    ).resolves.toMatchObject({ name: "TSRP Solar" });
  });

  it("adds a dated reference as a new version, newest first", async () => {
    const [own] = kits;
    if (own) {
      own.doc = {
        ...EMPTY_KIT,
        references: [
          {
            body: "Old",
            date: "2026-09-01",
            id: "r0",
            source: "",
            title: "Older",
          },
        ],
      };
    }
    const out = await tool("add_brand_reference").run(
      {
        body: "Teal is only for buttons.",
        date: "2026-10-30",
        kit: "Bird Creek",
        source: "Almanac: notes/bird-creek.md",
        title: "CTA colour",
      },
      ctx
    );
    expect(out).toMatchObject({
      added: true,
      kit: "Bird Creek Roofing",
      references: 2,
    });
    const doc = writes[0]?.doc as { references: { title: string }[] };
    expect(doc.references.map((r) => r.title)).toEqual(["CTA colour", "Older"]);
  });

  it("skips an exact duplicate", async () => {
    const [own] = kits;
    if (own) {
      own.doc = {
        ...EMPTY_KIT,
        references: [
          {
            body: "x",
            date: "2026-10-30",
            id: "r1",
            source: "s",
            title: "CTA colour",
          },
        ],
      };
    }
    const out = await tool("add_brand_reference").run(
      {
        body: "y",
        date: "2026-10-30",
        kit: "Bird Creek",
        source: "s",
        title: "cta colour",
      },
      ctx
    );
    expect(out).toMatchObject({ added: false });
    expect(writes).toHaveLength(0);
  });

  it("removes a reference by id, and refuses an unknown id", async () => {
    const [own] = kits;
    if (own) {
      own.doc = {
        ...EMPTY_KIT,
        references: [{ body: "x", date: "", id: "r1", source: "", title: "A" }],
      };
    }
    await expect(
      tool("remove_brand_reference").run({ id: "nope", kit: "Bird Creek" }, ctx)
    ).rejects.toThrow("no reference");
    await tool("remove_brand_reference").run(
      { id: "r1", kit: "Bird Creek" },
      ctx
    );
    const [write] = writes;
    expect(
      (write?.doc as { references: unknown[] } | undefined)?.references
    ).toHaveLength(0);
  });

  it("hands out a kit as DESIGN.md", async () => {
    const out = (await tool("get_design_md").run(
      { kit: "TSRP Solar" },
      ctx
    )) as {
      fileName: string;
      markdown: string;
      name: string;
    };
    expect(out.name).toBe("TSRP Solar");
    expect(out.fileName).toBe("DESIGN.md");
    expect(out.markdown).toContain("name: TSRP Solar");
    expect(out.markdown).toContain('primary: "#1f4d3a"');
    expect(tool("get_design_md").writes).toBeFalsy();
  });

  it("replaces a palette as a new version, dropping what isn't a colour", async () => {
    const out = (await tool("set_brand_palette").run(
      {
        kit: "Bird Creek Roofing",
        palette: [
          { name: "Red", role: "primary", value: "#C63B2E" },
          { name: "Paper", value: "#efe6d2" },
          { name: "Nope", value: "red" },
        ],
      },
      ctx
    )) as { dropped: number; palette: { value: string }[] };
    expect(out.dropped).toBe(1);
    expect(out.palette.map((p) => p.value)).toEqual(["#c63b2e", "#efe6d2"]);
    expect(writes.at(-1)?.kitId).toBe("11111111-1111-1111-1111-111111111111");
    expect(tool("set_brand_palette").writes).toBe(true);
  });
});
