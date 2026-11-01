import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import useSWR from "swr";
import { parseFontRef } from "../../config/fontRef.js";
import {
  ColourSection,
  ImagerySection,
  LogoSection,
  ReferenceSection,
  TypeSection,
} from "../components/brandGuide/GuideSections";
import {
  brandFaces,
  groupPalette,
  paperAndInk,
} from "../components/brandGuide/guideModel";
import { brandKitsApi } from "../services/brandKitService";
import { authStorage } from "../services/portfolioService";
import { loadFontRef } from "../theme/remoteFonts";
import "../components/brandGuide/BrandGuide.css";

/**
 * A brand kit as a guide: one page with Foundation, Colour, Type, Logo,
 * Imagery and References, set in the brand's own colours and type. Every
 * value copies on click. At /admin/brand-kits/:kitId/guide; it prints.
 */

const SECTIONS = [
  ["foundation", "Foundation"],
  ["colour", "Colour"],
  ["type", "Type"],
  ["logo", "Logo"],
  ["imagery", "Imagery"],
  ["references", "References"],
] as const;

export function BrandGuidePage() {
  const { kitId } = useParams<{ kitId: string }>();
  const navigate = useNavigate();
  const [authed] = useState(() => Boolean(authStorage.getToken()));
  const [active, setActive] = useState<string>("foundation");
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

  // Which section is in view, for the sidebar.
  useEffect(() => {
    if (!doc) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting);
        const [first] = seen.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        );
        if (first) {
          setActive(first.target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, [doc]);

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

  const groups = groupPalette(doc.palette);
  const stack = (ref: string | null | undefined) => {
    const parsed = parseFontRef(ref);
    return parsed ? `"${parsed.family}", var(--font-sans)` : undefined;
  };
  const theme = {
    "--guide-accent": groups.brand[0]?.value ?? "#1e3dff",
    "--guide-bg": paperAndInk(doc.palette).paper ?? "#f6f6f3",
    "--guide-body-font": stack(body?.ref),
    "--guide-head-font": stack(headline?.ref),
    "--guide-ink": paperAndInk(doc.palette).ink ?? "#0b0f1a",
  } as React.CSSProperties;

  return (
    <div className="guide" style={theme}>
      <Toaster position="top-center" />
      <aside className="guide__nav">
        <Link className="guide__back" to="/admin/brand-kits">
          <ArrowLeft size={14} /> Brand kits
        </Link>
        <p className="guide__brand">
          {kit.name}
          <span>Brand guide · v{kit.version ?? 0}</span>
        </p>
        <nav>
          {SECTIONS.map(([id, label]) => (
            <a
              aria-current={active === id ? "true" : undefined}
              href={`#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          className="guide__print"
          onClick={() => window.print()}
          type="button"
        >
          <Printer size={14} /> Print or save PDF
        </button>
      </aside>

      <main className="guide__main">
        <section className="guide-section guide-hero" id="foundation">
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

        <section className="guide-section" id="colour">
          <h2 className="guide-heading">Colour</h2>
          <ColourSection doc={doc} />
        </section>

        <section className="guide-section" id="type">
          <h2 className="guide-heading">Type</h2>
          <TypeSection doc={doc} />
        </section>

        <section className="guide-section" id="logo">
          <h2 className="guide-heading">Logo</h2>
          <LogoSection doc={doc} />
        </section>

        <section className="guide-section" id="imagery">
          <h2 className="guide-heading">Imagery</h2>
          <ImagerySection doc={doc} />
        </section>

        <section className="guide-section" id="references">
          <h2 className="guide-heading">References</h2>
          <ReferenceSection doc={doc} />
        </section>
      </main>
    </div>
  );
}
