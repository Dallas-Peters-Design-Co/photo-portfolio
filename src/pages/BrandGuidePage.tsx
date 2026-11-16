import { ArrowLeft, FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import useSWR from "swr";
import { parseFontRef } from "../../config/fontRef.js";
import { ComponentSection } from "../components/brandGuide/GuideComponents";
import {
  ColourSection,
  ImagerySection,
  LogoSection,
  ReferenceSection,
  TypeSection,
} from "../components/brandGuide/GuideSections";
import { brandFaces } from "../components/brandGuide/guideModel";
import { guideTheme } from "../components/brandGuide/guideTheme";
import { brandKitsApi } from "../services/brandKitService";
import { authStorage } from "../services/portfolioService";
import { loadFontRef } from "../theme/remoteFonts";
import "../components/brandGuide/BrandGuide.css";
import { DocSidebar } from "./DocShell";

/**
 * A brand kit as a guide: one page with Foundation, Colour, Type, Logo,
 * Imagery and References, set in the brand's own colours and type, in the
 * document frame the client review uses (DocShell). Every value copies on
 * click. At /admin/brand-kits/:kitId/guide; it prints.
 */

const SECTIONS = [
  ["foundation", "Foundation"],
  ["colour", "Colour"],
  ["type", "Type"],
  ["components", "Components"],
  ["logo", "Logo"],
  ["imagery", "Imagery"],
  ["references", "References"],
] as const;

const downloadDesignMd = async (kitId: string) => {
  try {
    const text = await brandKitsApi.designMd(kitId);
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "DESIGN.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Couldn't make the DESIGN.md");
  }
};

export function BrandGuidePage() {
  const { kitId } = useParams<{ kitId: string }>();
  const navigate = useNavigate();
  const [authed] = useState(() => Boolean(authStorage.getToken()));
  const { data: kit, error } = useSWR(
    authed && kitId ? ["kit", kitId] : null,
    () => brandKitsApi.get(kitId as string)
  );

  useEffect(() => {
    if (!authed) {
      navigate("/admin", { replace: true });
    }
  }, [authed, navigate]);

  const doc = kit?.resolvedDoc;
  const { body, headline } = brandFaces(doc);

  useEffect(() => {
    loadFontRef(headline?.ref);
    loadFontRef(body?.ref);
  }, [headline?.ref, body?.ref]);

  useEffect(() => {
    if (kit) {
      document.title = `${kit.name} — Brand guide`;
    }
  }, [kit]);

  if (error) {
    return (
      <div className="guide guide--message">
        <p>This brand kit couldn't be loaded.</p>
        <Link to="/admin/brand-kits">Back to brand kits</Link>
      </div>
    );
  }
  if (!(kit && doc)) {
    return <div className="guide guide--message">Loading…</div>;
  }

  const stack = (ref: string | null | undefined) => {
    const parsed = parseFontRef(ref);
    return parsed ? `"${parsed.family}", var(--font-sans)` : undefined;
  };
  const theme = {
    ...guideTheme(doc.palette),
    "--guide-body-font": stack(body?.ref),
    "--guide-head-font": stack(headline?.ref),
  } as React.CSSProperties;

  return (
    <div className="doc-shell guide" style={theme}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--guide-surface)",
            borderColor: "var(--guide-rule)",
            color: "var(--guide-ink)",
            fontFamily: "inherit",
          },
        }}
      />
      <DocSidebar
        card={
          <>
            <p className="doc-shell__card-kicker">
              Brand guide · v{kit.version ?? 0}
            </p>
            <p className="doc-shell__card-title">{kit.name}</p>
            <div className="doc-shell__actions">
              <button
                className="doc-shell__action"
                onClick={() => void downloadDesignMd(kit.id)}
                title="The brand as DESIGN.md, for coding and design agents"
                type="button"
              >
                <FileText aria-hidden size={14} /> DESIGN.md
              </button>
              <button
                className="doc-shell__action doc-shell__action--quiet"
                onClick={() => window.print()}
                type="button"
              >
                <Printer aria-hidden size={14} /> Print or PDF
              </button>
            </div>
          </>
        }
        contents={SECTIONS.map(([id, label]) => ({ id, label }))}
        foot={
          <p className="doc-shell__colophon">
            {kit.parentName
              ? `A sub-brand of ${kit.parentName}`
              : "Set in the brand's own colours and type"}
          </p>
        }
        head={
          <>
            <Link className="doc-shell__back" to="/admin/brand-kits">
              <ArrowLeft aria-hidden size={14} /> Brand kits
            </Link>
            <p className="doc-shell__wordmark">{kit.name}</p>
          </>
        }
        label="Brand guide"
      />

      <main className="doc-shell__main">
        <section className="doc-band guide-hero" id="foundation">
          <p className="guide-eyebrow">Brand guide</p>
          <h1 className="guide-hero__name">{kit.name}</h1>
          {kit.parentName ? (
            <p className="guide-lede">A sub-brand of {kit.parentName}.</p>
          ) : null}
          {doc.voice ? (
            <div className="guide-voice">
              <h2 className="guide-subhead">Voice</h2>
              <p>{doc.voice}</p>
            </div>
          ) : null}
          <div className="guide-hero__strip">
            {doc.palette.map((p) => (
              <span
                key={p.value + p.name}
                style={{ background: p.value }}
                title={p.name}
              />
            ))}
          </div>
        </section>

        <section className="doc-band" id="colour">
          <h2 className="doc-band__title">Colour</h2>
          <ColourSection doc={doc} />
        </section>

        <section className="doc-band" id="type">
          <h2 className="doc-band__title">Type</h2>
          <TypeSection doc={doc} />
        </section>

        <section className="doc-band" id="components">
          <h2 className="doc-band__title">Components</h2>
          <ComponentSection doc={doc} />
        </section>

        <section className="doc-band" id="logo">
          <h2 className="doc-band__title">Logo</h2>
          <LogoSection doc={doc} />
        </section>

        <section className="doc-band" id="imagery">
          <h2 className="doc-band__title">Imagery</h2>
          <ImagerySection doc={doc} />
        </section>

        <section className="doc-band" id="references">
          <h2 className="doc-band__title">References</h2>
          <ReferenceSection doc={doc} />
        </section>
      </main>
    </div>
  );
}
