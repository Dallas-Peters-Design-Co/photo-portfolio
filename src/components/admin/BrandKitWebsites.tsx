import { Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { MAX_WEBSITES, sanitizeWebsites } from "../../../config/siteScan.js";
import { Button } from "../ui/button";
import { ReferencesEditor } from "./BrandKitLibrary";

/**
 * The brand's live websites, and what scanning them found. The scan runs on
 * the Mac (`pnpm design-md:scan "<kit>"`, a real browser) and saves back
 * through the site connector; the DESIGN.md then describes the components
 * as each site draws them.
 */

const date = (iso: string) => iso.slice(0, 10);
const SCHEME = /^https?:\/\//i;

export function WebsitesEditor({
  doc,
  kitName,
  onChange,
}: {
  doc: BrandKitDoc;
  kitName: string;
  onChange: (next: BrandKitDoc) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const url = SCHEME.test(draft.trim())
      ? draft.trim()
      : `https://${draft.trim()}`;
    const websites = sanitizeWebsites([...doc.websites, url]);
    if (websites.length > doc.websites.length) {
      onChange({ ...doc, websites });
      setDraft("");
    }
  };
  const remove = (url: string) =>
    onChange({
      ...doc,
      scans: doc.scans.filter((s) => s.url !== url),
      websites: doc.websites.filter((w) => w !== url),
    });

  return (
    <div className="stack stack--tight">
      {doc.websites.map((url) => {
        const scan = doc.scans.find(
          (s) => s.url === url || s.url.startsWith(url)
        );
        return (
          <div className="row row--between" key={url}>
            <span className="row row--snug">
              <Globe aria-hidden size={14} />
              <a href={url} rel="noreferrer" target="_blank">
                {url.replace(SCHEME, "")}
              </a>
              <span className="brand-kit__hint">
                {scan
                  ? `scanned ${date(scan.scannedAt)}: ${scan.components.map((c) => c.name).join(", ") || "no components"}`
                  : "not scanned yet"}
              </span>
            </span>
            <Button
              aria-label={`Remove ${url}`}
              onClick={() => remove(url)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      })}
      {doc.websites.length < MAX_WEBSITES ? (
        <form
          className="row row--snug"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            aria-label="Website"
            className="admin-control"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="unrulychain.com"
            value={draft}
          />
          <Button disabled={!draft.trim()} type="submit" variant="outline">
            Add
          </Button>
        </form>
      ) : null}
      <p className="brand-kit__hint">
        Save, then scan from the repo on your Mac:{" "}
        <code>pnpm design-md:scan "{kitName}"</code>. It reads the live sites'
        buttons, links, inputs, cards, nav and type into this brand's DESIGN.md.
      </p>
    </div>
  );
}

/** Websites, then references: where the brand lives and what was decided. */
export function BrandSources({
  doc,
  kitName,
  onChange,
}: {
  doc: BrandKitDoc;
  kitName: string;
  onChange: (next: BrandKitDoc) => void;
}) {
  return (
    <>
      <section className="stack stack--snug">
        <h3 className="admin-caps">Websites</h3>
        <WebsitesEditor doc={doc} kitName={kitName} onChange={onChange} />
      </section>
      <section className="stack stack--snug">
        <h3 className="admin-caps">References</h3>
        <ReferencesEditor doc={doc} onChange={onChange} />
      </section>
    </>
  );
}
