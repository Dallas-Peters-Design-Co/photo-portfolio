import { Check, Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  BrandKitDoc,
  LogoEntry,
  PaletteEntry,
  TypefaceEntry,
} from "../../../config/brandKit.js";
import { parseFontRef } from "../../../config/fontRef.js";
import { styleCss } from "../../../config/typeScale.js";
import { LOOKS } from "../../editor/presets";
import { useCollectionImages } from "../../hooks/useCollectionImages";
import { loadFontRef } from "../../theme/remoteFonts";
import { facesFor, familyFor } from "../typeScale/faces";
import {
  colourName,
  groupPalette,
  inkOn,
  paperAndInk,
  valuesOf,
} from "./guideModel";
import { useLogoTone } from "./logoTone";

/** The sections of a brand guide, each a function of the kit's document. */

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="guide-copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        toast.success(`${value} copied`);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={`Copy ${label}`}
      type="button"
    >
      <span className="guide-copy__label">{label}</span>
      <span className="guide-copy__value">{value}</span>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function ColourCard({ entry, large }: { entry: PaletteEntry; large: boolean }) {
  const v = valuesOf(entry.value);
  return (
    <article
      className={[
        "guide-colour",
        `guide-colour--${inkOn(entry.value)}`,
        large ? "guide-colour--large" : "",
      ].join(" ")}
      style={{ background: entry.value }}
    >
      <header className="guide-colour__head">
        <h3 className="guide-colour__name">{colourName(entry) || v.hex}</h3>
        {entry.role ? (
          <span className="guide-colour__role">{entry.role}</span>
        ) : null}
      </header>
      <div className="guide-colour__values">
        <CopyValue label="HEX" value={v.hex} />
        <CopyValue label="RGB" value={v.rgb} />
        <CopyValue label="OKLCH" value={v.oklch} />
      </div>
    </article>
  );
}

export function ColourSection({ doc }: { doc: BrandKitDoc }) {
  const groups = groupPalette(doc.palette);
  if (doc.palette.length === 0) {
    return <p className="guide-empty">No colours in this kit yet.</p>;
  }
  return (
    <>
      {groups.brand.length > 0 ? (
        <div className="guide-colours guide-colours--brand">
          {groups.brand.map((entry) => (
            <ColourCard entry={entry} key={entry.value + entry.name} large />
          ))}
        </div>
      ) : null}
      {groups.neutral.length > 0 ? (
        <>
          <h3 className="guide-subhead">Neutral</h3>
          <div className="guide-colours">
            {groups.neutral.map((entry) => (
              <ColourCard
                entry={entry}
                key={entry.value + entry.name}
                large={false}
              />
            ))}
          </div>
        </>
      ) : null}
      {groups.signal.length > 0 ? (
        <>
          <h3 className="guide-subhead">Signal</h3>
          <div className="guide-colours">
            {groups.signal.map((entry) => (
              <ColourCard
                entry={entry}
                key={entry.value + entry.name}
                large={false}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

const SOURCE = { adobe: "Adobe Fonts", google: "Google Fonts" } as const;

const SAMPLE = "Sphinx of black quartz, judge my vow.";
const SAMPLE_FOR = { body: SAMPLE, headline: "The quick brown fox" } as const;

function Typeface({ face }: { face: TypefaceEntry }) {
  const ref = parseFontRef(face.ref);
  useEffect(() => {
    loadFontRef(face.ref);
  }, [face.ref]);
  const family = `"${ref?.family ?? face.name}", var(--font-sans)`;
  const weights = face.weights.length > 0 ? face.weights : [400, 700];
  return (
    <article className="guide-type">
      <div className="guide-type__specimen" style={{ fontFamily: family }}>
        Aa
      </div>
      <div className="guide-type__body">
        <header className="guide-type__head">
          <h3 style={{ fontFamily: family }}>{face.name}</h3>
          <span>
            {face.role || "Typeface"}
            {" · "}
            {ref ? SOURCE[ref.source] : "Not loadable"}
          </span>
        </header>
        <p className="guide-type__sample" style={{ fontFamily: family }}>
          {SAMPLE}
        </p>
        <div className="guide-type__weights">
          {weights.map((w) => (
            <span key={w} style={{ fontFamily: family, fontWeight: w }}>
              <strong>Ag</strong>
              <small>{w}</small>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

/** The kit's type scale, each style set in its face. */
function TypeScaleRows({ doc }: { doc: BrandKitDoc }) {
  const faces = facesFor(doc.typefaces);
  const styles = doc.typeScale?.styles ?? [];
  if (styles.length === 0) {
    return null;
  }
  return (
    <div className="guide-scale">
      {styles.map((s) => (
        <div className="guide-scale__row" key={s.name}>
          <div className="guide-scale__spec">
            <strong>{s.name}</strong>
            <span>
              {s.size}px / {s.lineHeight} · {s.weight}
              {s.tracking ? ` · ${s.tracking}em` : ""}
            </span>
          </div>
          <p
            className="guide-scale__sample"
            style={{ ...styleCss(s), fontFamily: familyFor(faces, s.face) }}
          >
            {SAMPLE_FOR[s.face]}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TypeSection({ doc }: { doc: BrandKitDoc }) {
  if (doc.typefaces.length === 0 && !doc.typeScale) {
    return <p className="guide-empty">No typefaces in this kit yet.</p>;
  }
  return (
    <>
      <div className="guide-types">
        {doc.typefaces.map((face) => (
          <Typeface face={face} key={face.name + face.role} />
        ))}
      </div>
      <TypeScaleRows doc={doc} />
    </>
  );
}

function Logo({ logo, ground }: { ground: string; logo: LogoEntry }) {
  return (
    <figure
      className={`guide-logo guide-logo--${inkOn(ground)}`}
      style={{ background: ground }}
    >
      {/* The mark at a fixed share of the tile, its clear space drawn as
          padding in the same units, so 50% clear space reads as half the
          mark's width on every side. */}
      <div
        className="guide-logo__clear"
        style={{ ["--clear" as string]: logo.clearSpace }}
      >
        <img alt={logo.label} height={120} src={logo.url} width={240} />
      </div>
    </figure>
  );
}

/** One logo, on the ground its own ink was made for. */
function ToneLogo({
  grounds,
  logo,
}: {
  grounds: { dark: string; light: string };
  logo: LogoEntry;
}) {
  const tone = useLogoTone(logo.label, logo.url);
  return (
    <Logo
      ground={tone === "light" ? grounds.dark : grounds.light}
      logo={logo}
    />
  );
}

export function LogoSection({ doc }: { doc: BrandKitDoc }) {
  if (doc.logos.length === 0) {
    return <p className="guide-empty">No logos in this kit yet.</p>;
  }
  const { ink, paper } = paperAndInk(doc.palette);
  const grounds = { dark: ink ?? "#0b0f1a", light: paper ?? "#ffffff" };
  return (
    <div className="guide-logos">
      {doc.logos.map((logo) => (
        <article className="guide-logos__entry" key={logo.url}>
          <ToneLogo grounds={grounds} logo={logo} />
          <footer className="guide-logos__meta">
            <strong>{logo.label || "Logo"}</strong>
            {logo.minWidth ? <span>Min width {logo.minWidth}px</span> : null}
            {logo.clearSpace ? (
              <span>
                Clear space {Math.round(logo.clearSpace * 100)}% of width
              </span>
            ) : null}
            <a className="guide-download" download href={logo.url}>
              <Download size={12} /> Download
            </a>
          </footer>
          {logo.rules ? (
            <p className="guide-logos__rules">{logo.rules}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ImagerySection({ doc }: { doc: BrandKitDoc }) {
  const { images: library } = useCollectionImages(doc.libraryCollectionId);
  if (
    doc.onBrand.length === 0 &&
    doc.offBrand.length === 0 &&
    library.length === 0
  ) {
    return <p className="guide-empty">No imagery examples in this kit yet.</p>;
  }
  const look = doc.look ? LOOKS.find((l) => l.id === doc.look?.id) : null;
  return (
    <>
      {look ? (
        <p className="guide-lede">
          Photography is graded with <strong>{look.name}</strong> ({look.code})
          at {Math.round((doc.look?.strength ?? 1) * 100)}%.
        </p>
      ) : null}
      {doc.onBrand.length > 0 ? (
        <>
          <h3 className="guide-subhead">This</h3>
          <div className="guide-images">
            {doc.onBrand.map((url) => (
              <img
                alt=""
                height={300}
                key={url}
                loading="lazy"
                src={url}
                width={300}
              />
            ))}
          </div>
        </>
      ) : null}
      {library.length > 0 ? (
        <>
          <h3 className="guide-subhead">Library</h3>
          <div className="guide-images">
            {library.map((item) => (
              <img
                alt={item.alt ?? ""}
                height={300}
                key={item.id}
                loading="lazy"
                src={item.url}
                width={300}
              />
            ))}
          </div>
        </>
      ) : null}
      {doc.offBrand.length > 0 ? (
        <>
          <h3 className="guide-subhead">Not this</h3>
          <div className="guide-images guide-images--off">
            {doc.offBrand.map((url) => (
              <img
                alt=""
                height={300}
                key={url}
                loading="lazy"
                src={url}
                width={300}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export function ReferenceSection({ doc }: { doc: BrandKitDoc }) {
  if (doc.references.length === 0) {
    return (
      <p className="guide-empty">
        No references yet. Add decisions and feedback in the kit.
      </p>
    );
  }
  return (
    <ol className="guide-refs">
      {doc.references.map((ref) => (
        <li key={ref.id}>
          <time>{ref.date}</time>
          <div>
            <h3>{ref.title || "Untitled"}</h3>
            <p>{ref.body}</p>
            {ref.source ? <small>{ref.source}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
