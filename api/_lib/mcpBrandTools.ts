import {
  type BrandReference,
  MAX_PALETTE,
  MAX_REFERENCES,
  sanitizeKitDoc,
  sanitizeReferences,
} from "../../config/brandKit.js";
import { designMd } from "../../config/designMd.js";
import {
  type BrandKitDto,
  loadKit,
  loadKits,
  writeKitVersion,
} from "./brandKitStore.js";
import type { getSql } from "./db.js";
import { type McpTool, ToolError } from "./mcp.js";

/**
 * Brand kits through the site connector: read a brand (colours, type, logos,
 * voice, look, library and references), and add or remove references.
 *
 * References are how notes reach a brand: Claude reads Dallas's Almanac notes
 * and meetings on his Mac, then files the decisions and feedback here with the
 * note's path as the source. Each change writes a new kit version, like a
 * save in the admin, so nothing is overwritten and the history shows it.
 */

type Sql = ReturnType<typeof getSql>;
interface Ctx {
  sql: Sql;
}

const UUID = /^[0-9a-f-]{36}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A kit by id, or by name (case-insensitive, exact then prefix). */
export const findKit = async (sql: Sql, kit: unknown): Promise<BrandKitDto> => {
  const wanted = typeof kit === "string" ? kit.trim() : "";
  if (!wanted) {
    throw new ToolError("Say which brand kit (its name or id).");
  }
  if (UUID.test(wanted)) {
    const found = await loadKit(sql, wanted);
    if (found) {
      return found;
    }
  }
  const kits = await loadKits(sql);
  const lower = wanted.toLowerCase();
  const exact = kits.filter((k) => k.name.toLowerCase() === lower);
  const prefix = kits.filter((k) => k.name.toLowerCase().startsWith(lower));
  const matches = exact.length > 0 ? exact : prefix;
  if (matches.length === 1 && matches[0]) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new ToolError(
      `More than one kit matches "${wanted}": ${matches.map((k) => k.name).join(", ")}.`
    );
  }
  throw new ToolError(
    `No brand kit called "${wanted}". Kits: ${kits.map((k) => k.name).join(", ") || "none yet"}.`
  );
};

const summary = (kit: BrandKitDto) => ({
  id: kit.id,
  name: kit.name,
  parent: kit.parentName,
  references: kit.resolvedDoc.references.length,
  updatedAt: kit.updatedAt,
  version: kit.version,
});

const listBrandKits: McpTool<Ctx> = {
  description:
    "Every brand kit (client brands and sub-brands): name, parent brand, how many references it holds, and its current version.",
  inputSchema: { properties: {}, type: "object" },
  name: "list_brand_kits",
  run: async (_args, { sql }) => (await loadKits(sql)).map(summary),
};

const getBrandKit: McpTool<Ctx> = {
  description:
    "One brand in full, with the parent brand folded in: palette (hex, name, role), typefaces, logos and their usage rules, voice, photo look, image-library collection, and its references (dated notes, decisions and feedback, newest first). `inherited` lists the parts that come from the parent.",
  inputSchema: {
    properties: {
      kit: { description: "Brand kit name or id", type: "string" },
    },
    required: ["kit"],
    type: "object",
  },
  name: "get_brand_kit",
  run: async ({ kit }, { sql }) => {
    const found = await findKit(sql, kit);
    return {
      ...summary(found),
      brand: found.resolvedDoc,
      inherited: found.inherited,
    };
  },
};

/** The kit as a DESIGN.md file, for agents and for the Obsidian vault sync. */
export const designMdOf = (kit: BrandKitDto): string =>
  designMd({
    doc: kit.resolvedDoc,
    name: kit.name,
    parentName: kit.parentName,
    version: kit.version,
  });

const getDesignMd: McpTool<Ctx> = {
  description:
    "One brand as a DESIGN.md file (the open google-labs-code/design.md format): colour and type tokens in YAML front matter, then the voice, colours, type, logo rules, on- and off-brand imagery, do's and don'ts, and references in Markdown. Write it into a project or notes as-is.",
  inputSchema: {
    properties: {
      kit: { description: "Brand kit name or id", type: "string" },
    },
    required: ["kit"],
    type: "object",
  },
  name: "get_design_md",
  run: async ({ kit }, { sql }) => {
    const found = await findKit(sql, kit);
    return {
      ...summary(found),
      fileName: "DESIGN.md",
      markdown: designMdOf(found),
    };
  },
};

const setBrandPalette: McpTool<Ctx> = {
  description:
    'Replace a brand kit\'s colour palette, in order: each colour a six-digit hex, with an optional name and role ("primary", "text", "surface"…). Saved as a new version of the kit, so the old palette stays in its history. For a sub-brand it sets the sub-brand\'s own palette.',
  inputSchema: {
    properties: {
      kit: { description: "Brand kit name or id", type: "string" },
      palette: {
        description: `The new palette, at most ${MAX_PALETTE} colours`,
        items: {
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            value: { description: "#rrggbb", type: "string" },
          },
          required: ["value"],
          type: "object",
        },
        type: "array",
      },
    },
    required: ["kit", "palette"],
    type: "object",
  },
  name: "set_brand_palette",
  run: async (args, { sql }) => {
    const found = await findKit(sql, args.kit);
    const asked = Array.isArray(args.palette) ? args.palette.length : 0;
    // The kit's own sanitiser decides what a colour is, so this tool can't
    // store anything the admin wouldn't.
    const { palette } = sanitizeKitDoc({ palette: args.palette });
    if (palette.length === 0) {
      throw new ToolError("No usable colours: give each one as #rrggbb.");
    }
    const version = await writeKitVersion(sql, found.id, {
      ...found.doc,
      palette,
    });
    return {
      dropped: asked - palette.length,
      kit: found.name,
      palette,
      version: version?.version ?? null,
    };
  },
  writes: true,
};

const setBrandScan: McpTool<Ctx> = {
  description:
    "Save what scanning a brand's live websites found (from `pnpm design-md:scan`): per site, its components, type scale, radii and spacing. Replaces earlier scans of the same sites, adds the sites to the kit's websites, and saves a new version. The kit's DESIGN.md then describes those components.",
  inputSchema: {
    properties: {
      kit: { description: "Brand kit name or id", type: "string" },
      scans: {
        description: "One scan per site, as scripts/scanPage.mjs returns it",
        items: { type: "object" },
        type: "array",
      },
      websites: {
        description: "The sites to keep on the kit (added to any it has)",
        items: { type: "string" },
        type: "array",
      },
    },
    required: ["kit", "scans"],
    type: "object",
  },
  name: "set_brand_scan",
  run: async (args, { sql }) => {
    const found = await findKit(sql, args.kit);
    const own = found.doc;
    const incoming = sanitizeKitDoc({
      scans: args.scans,
      websites: [
        ...own.websites,
        ...(Array.isArray(args.websites) ? args.websites : []),
        ...(Array.isArray(args.scans)
          ? args.scans.map((s) => (s as { url?: unknown } | null)?.url)
          : []),
      ],
    });
    if (incoming.scans.length === 0) {
      throw new ToolError("No usable scans: each needs the site's url.");
    }
    const fresh = new Set(incoming.scans.map((s) => s.url));
    const doc = sanitizeKitDoc({
      ...own,
      scans: [...incoming.scans, ...own.scans.filter((s) => !fresh.has(s.url))],
      websites: incoming.websites,
    });
    const version = await writeKitVersion(sql, found.id, doc);
    return {
      kit: found.name,
      scans: doc.scans.map((s) => ({
        components: s.components.map((c) => c.name),
        url: s.url,
      })),
      version: version?.version ?? null,
      websites: doc.websites,
    };
  },
  writes: true,
};

/** Same title, date and source: the same note filed twice. */
const isDuplicate = (a: BrandReference, b: BrandReference) =>
  a.title.toLowerCase() === b.title.toLowerCase() &&
  a.date === b.date &&
  a.source === b.source;

const addBrandReference: McpTool<Ctx> = {
  description:
    "Add a reference to a brand kit: a decision, client feedback, call notes or a link, with the date and where it came from (for example the Almanac note path). Saved as a new version of the kit. Skips an exact duplicate (same title, date and source). For a sub-brand, it is added to the sub-brand itself.",
  inputSchema: {
    properties: {
      body: {
        description: "What was decided, said or learned",
        type: "string",
      },
      date: {
        description: "YYYY-MM-DD it happened (optional)",
        type: "string",
      },
      kit: { description: "Brand kit name or id", type: "string" },
      source: {
        description:
          "Where it came from: an Almanac note path, an email, a URL",
        type: "string",
      },
      title: { description: "Short title", type: "string" },
    },
    required: ["kit", "title", "body"],
    type: "object",
  },
  name: "add_brand_reference",
  run: async (args, { sql }) => {
    const found = await findKit(sql, args.kit);
    const date =
      typeof args.date === "string" && ISO_DATE.test(args.date)
        ? args.date
        : "";
    const [incoming] = sanitizeReferences([
      {
        body: args.body,
        date,
        id: `ref-${Date.now().toString(36)}`,
        source: args.source,
        title: args.title,
      },
    ]);
    if (!incoming) {
      throw new ToolError("A reference needs a title or some text.");
    }
    const own = found.doc;
    if (own.references.some((r) => isDuplicate(r, incoming))) {
      return { added: false, kit: found.name, reason: "Already there." };
    }
    if (own.references.length >= MAX_REFERENCES) {
      throw new ToolError(
        `"${found.name}" already holds ${MAX_REFERENCES} references. Remove some first.`
      );
    }
    const references = [incoming, ...own.references].sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
    );
    const version = await writeKitVersion(sql, found.id, {
      ...own,
      references,
    });
    return {
      added: true,
      id: incoming.id,
      kit: found.name,
      references: references.length,
      version: version?.version ?? null,
    };
  },
  writes: true,
};

const removeBrandReference: McpTool<Ctx> = {
  description:
    "Remove one reference from a brand kit by its id (from get_brand_kit). Saved as a new version, so the old one stays in the kit's history.",
  inputSchema: {
    properties: {
      id: { description: "The reference id", type: "string" },
      kit: { description: "Brand kit name or id", type: "string" },
    },
    required: ["kit", "id"],
    type: "object",
  },
  name: "remove_brand_reference",
  run: async ({ kit, id }, { sql }) => {
    const found = await findKit(sql, kit);
    const own = found.doc;
    const references = own.references.filter((r) => r.id !== id);
    if (references.length === own.references.length) {
      throw new ToolError(
        `"${found.name}" has no reference with that id of its own.`
      );
    }
    const version = await writeKitVersion(sql, found.id, {
      ...own,
      references,
    });
    return { kit: found.name, removed: id, version: version?.version ?? null };
  },
  writes: true,
};

export const BRAND_TOOLS: McpTool<Ctx>[] = [
  getDesignMd,
  setBrandPalette,
  setBrandScan,
  listBrandKits,
  getBrandKit,
  addBrandReference,
  removeBrandReference,
];
