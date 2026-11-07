import {
  Check,
  Copy,
  Download,
  Globe,
  RefreshCw,
  ScanSearch,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc, LogoEntry } from "../../../config/brandKit.js";
import { designMd } from "../../../config/designMd.js";
import {
  MAX_WEBSITES,
  type SiteScan,
  sanitizeWebsites,
} from "../../../config/siteScan.js";
import { type SiteFindings, scanSite } from "../../lib/scanSite";
import {
  logosWithScan,
  paletteWithScan,
  scannedLogoLabel,
} from "../../lib/scanTheme";
import { brandKitsApi } from "../../services/brandKitService";
import { facesFor } from "../typeScale/faces";
import { TypeScaleEditor } from "../typeScale/TypeScaleEditor";
import { Button } from "../ui/button";
import { ReferencesEditor } from "./BrandKitLibrary";
import "./BrandKitWebsites.css";

/**
 * The brand's live websites and its DESIGN.md, all from the kit page.
 *
 * Scan reads each site's components, type, radii and spacing in this browser
 * (lib/scanSite.ts); the preview is the DESIGN.md the kit will produce, live
 * as the kit is edited; Copy and Download hand it over. Saving the kit is what
 * reaches the vault, the brand guide and the connector.
 */

const SCHEME = /^https?:\/\//i;
const date = (iso: string) => iso.slice(0, 10);

const scanFor = (doc: BrandKitDoc, url: string) =>
  doc.scans.find((s) => s.url === url || s.url.startsWith(url));

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** What a scan added, for the toast. */
const findingsNote = (components: number, colours: number, logos: number) => {
  const parts = [plural(components, "component")];
  if (colours > 0) {
    parts.push(`${plural(colours, "new colour")} for the palette`);
  }
  if (logos > 0) {
    parts.push(logos === 1 ? "the logo" : plural(logos, "logo"));
  }
  return `Found ${parts.join(", ")}. Save the kit to keep them.`;
};

/**
 * The kit's logos with each scanned site's logo kept as our own file and
 * added, once per site (a rescan finds it by its label). One that can't be
 * kept is reported and skipped; the rest of the scan still lands.
 */
const keptLogos = async (
  logos: LogoEntry[],
  found: SiteFindings[]
): Promise<LogoEntry[]> => {
  let out = logos;
  for (const f of found) {
    const label = scannedLogoLabel(f.scan.url);
    if (!f.logo || out.some((l) => l.label === label)) {
      continue;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: a handful of sites, kept in order
      const url = await brandKitsApi.siteLogo(
        f.logo.kind === "svg" ? { svg: f.logo.svg } : { src: f.logo.src }
      );
      out = logosWithScan(out, label, url);
    } catch (e) {
      toast.error(
        `${label}: ${e instanceof Error ? e.message : "couldn't keep it"}`
      );
    }
  }
  return out;
};

function WebsiteRow({
  busy,
  onRemove,
  onScan,
  scan,
  url,
}: {
  busy: boolean;
  onRemove: () => void;
  onScan: () => void;
  scan: SiteScan | undefined;
  url: string;
}) {
  return (
    <div className="kit-sites__row">
      <Globe aria-hidden size={14} />
      <div className="kit-sites__site">
        <a href={url} rel="noreferrer" target="_blank">
          {url.replace(SCHEME, "")}
        </a>
        <span className="brand-kit__hint">
          {scan
            ? `Scanned ${date(scan.scannedAt)}: ${scan.components.map((c) => c.name).join(", ") || "no components found"}`
            : "Not scanned yet"}
        </span>
      </div>
      <Button
        disabled={busy}
        onClick={onScan}
        size="sm"
        type="button"
        variant="outline"
      >
        {busy ? (
          <RefreshCw className="kit-sites__spin" size={14} />
        ) : (
          <ScanSearch size={14} />
        )}
        {scan ? "Rescan" : "Scan"}
      </Button>
      <Button
        aria-label={`Remove ${url}`}
        onClick={onRemove}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

export function WebsitesEditor({
  doc,
  onChange,
}: {
  doc: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const add = () => {
    const raw = draft.trim();
    const url = SCHEME.test(raw) ? raw : `https://${raw}`;
    const websites = sanitizeWebsites([...doc.websites, url]);
    if (websites.length > doc.websites.length) {
      onChange({ ...doc, websites });
      setDraft("");
    }
  };

  const remove = (url: string) =>
    onChange({
      ...doc,
      scans: doc.scans.filter((s) => s !== scanFor(doc, url)),
      websites: doc.websites.filter((w) => w !== url),
    });

  /**
   * Scans the sites, one at a time, then puts every result on the kit: the
   * components for the DESIGN.md, the colour variables added to the palette
   * and the logo added to the logos (each once, never replacing).
   */
  const scan = async (urls: string[]) => {
    setBusy(new Set(urls));
    const found: SiteFindings[] = [];
    for (const url of urls) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: one hidden frame at a time
        found.push(await scanSite(url));
      } catch (e) {
        toast.error(
          `${url.replace(SCHEME, "")}: ${e instanceof Error ? e.message : "couldn't scan"}`
        );
      }
      setBusy((was) => new Set([...was].filter((u) => u !== url)));
    }
    if (found.length === 0) {
      return;
    }
    const logos = await keptLogos(doc.logos, found);
    const palette = found.reduce(
      (p, f) => paletteWithScan(p, f.colors),
      doc.palette
    );
    const replaced = new Set(urls.map((u) => scanFor(doc, u)));
    onChange({
      ...doc,
      logos,
      palette,
      scans: [
        ...found.map((f) => f.scan),
        ...doc.scans.filter((s) => !replaced.has(s)),
      ],
    });
    toast.success(
      findingsNote(
        found.reduce((n, f) => n + f.scan.components.length, 0),
        palette.length - doc.palette.length,
        logos.length - doc.logos.length
      )
    );
  };

  return (
    <div className="stack stack--tight">
      {doc.websites.map((url) => (
        <WebsiteRow
          busy={busy.has(url)}
          key={url}
          onRemove={() => remove(url)}
          onScan={() => void scan([url])}
          scan={scanFor(doc, url)}
          url={url}
        />
      ))}
      <div className="row row--snug">
        {doc.websites.length < MAX_WEBSITES ? (
          <form
            className="kit-sites__add"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              aria-label="Website"
              className="admin-control"
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a website, e.g. unrulychain.com"
              value={draft}
            />
            <Button disabled={!draft.trim()} type="submit" variant="outline">
              Add
            </Button>
          </form>
        ) : null}
        {doc.websites.length > 1 ? (
          <Button
            disabled={busy.size > 0}
            onClick={() => void scan(doc.websites)}
            type="button"
            variant="outline"
          >
            <ScanSearch size={14} /> Scan all
          </Button>
        ) : null}
      </div>
      <p className="brand-kit__hint">
        Scanning reads the buttons, links, inputs, cards, nav, type, corner
        radii and spacing each site draws, for the DESIGN.md below. It also adds
        the site's colour variables to the palette and its logo to the logos,
        without replacing what's there.
      </p>
    </div>
  );
}

/** The DESIGN.md this kit makes, as edited, with Copy and Download. */
export function DesignMdPreview({
  effective,
  kitName,
}: {
  effective: BrandKitDoc;
  kitName: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = designMd({ doc: effective, name: kitName });
  const copy = () => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success("DESIGN.md copied");
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "DESIGN.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <div className="stack stack--tight">
      <div className="row row--snug">
        <Button onClick={copy} size="sm" type="button" variant="outline">
          {copied ? <Check size={14} /> : <Copy size={14} />} Copy
        </Button>
        <Button onClick={download} size="sm" type="button" variant="outline">
          <Download size={14} /> Download
        </Button>
      </div>
      <pre className="kit-sites__preview">{text}</pre>
      <p className="brand-kit__hint">
        Saved kits sync to your Obsidian vault (20 Areas/Brands) within 15
        minutes, and to the brand guide and the site connector right away.
      </p>
    </div>
  );
}

/** Websites, the type scale, DESIGN.md, then references. */
export function BrandSources({
  doc,
  effective,
  kitName,
  onChange,
}: {
  doc: BrandKitDoc;
  effective: BrandKitDoc;
  kitName: string;
  onChange: (next: BrandKitDoc) => void;
}) {
  return (
    <>
      <section className="stack stack--snug">
        <h3 className="admin-caps">Websites</h3>
        <WebsitesEditor doc={doc} onChange={onChange} />
      </section>
      <section className="stack stack--snug">
        <h3 className="admin-caps">Type &amp; spacing scale</h3>
        {doc.typeScale === null && effective.typeScale ? (
          <p className="brand-kit__hint">
            Inherited from the parent kit. Edit to give this kit its own.
          </p>
        ) : null}
        <TypeScaleEditor
          faces={facesFor(effective.typefaces)}
          onChange={(typeScale) => onChange({ ...doc, typeScale })}
          scan={effective.scans[0]}
          value={doc.typeScale ?? effective.typeScale}
        />
      </section>
      <section className="stack stack--snug">
        <h3 className="admin-caps">DESIGN.md</h3>
        <DesignMdPreview effective={effective} kitName={kitName} />
      </section>
      <section className="stack stack--snug">
        <h3 className="admin-caps">References</h3>
        <ReferencesEditor doc={doc} onChange={onChange} />
      </section>
    </>
  );
}
