import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { collectionsApi } from "../../services/libraryService";
import { useActiveBrand } from "../brand/ActiveBrand";
import "./BrandDock.css";

/**
 * The board's Brand panel: the active brand's colours, logos, image library
 * and references, ready to grab while working.
 *
 * Choosing a brand here also gives every colour picker on the board that
 * brand's palette as its swatches (see ActiveBrand). Colours copy their hex on
 * click; logos and library images drop onto the board as image items.
 */

export interface BrandDockInsert {
  imageUrl: string;
  thumbUrl: string;
}

const copy = (hex: string) => {
  void navigator.clipboard?.writeText(hex);
  toast.success(`${hex} copied`);
};

function Library({
  collectionId,
  onInsert,
}: {
  collectionId: string;
  onInsert: (image: BrandDockInsert) => void;
}) {
  const { data, isLoading } = useSWR(["collection", collectionId], () =>
    collectionsApi.get(collectionId)
  );
  const images = (data?.items ?? []).filter((item) => item.kind === "image");
  if (isLoading) {
    return <p className="brand-dock__empty">Loading…</p>;
  }
  if (images.length === 0) {
    return (
      <p className="brand-dock__empty">
        The library is empty. Add images to its collection from any board.
      </p>
    );
  }
  return (
    <div className="brand-dock__grid">
      {images.map((item) => (
        <button
          className="brand-dock__tile"
          key={item.id}
          onClick={() => onInsert({ imageUrl: item.url, thumbUrl: item.url })}
          title={item.title ?? "Add to board"}
          type="button"
        >
          <img
            alt={item.alt ?? item.title ?? ""}
            height={96}
            loading="lazy"
            src={item.url}
            width={96}
          />
        </button>
      ))}
    </div>
  );
}

export function BrandDock({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (image: BrandDockInsert) => void;
}) {
  const brand = useActiveBrand();
  const [openRef, setOpenRef] = useState<string | null>(null);
  if (!brand) {
    return null;
  }
  const doc = brand.kit?.resolvedDoc ?? null;

  return (
    <aside aria-label="Brand" className="brand-dock">
      <header className="brand-dock__head">
        <select
          aria-label="Brand"
          className="brand-dock__select"
          onChange={(e) => brand.setKitId(e.target.value || null)}
          value={brand.kit?.id ?? ""}
        >
          <option value="">Choose a brand…</option>
          {brand.kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <button
          aria-label="Close brand panel"
          className="brand-dock__close"
          onClick={onClose}
          type="button"
        >
          <X size={14} />
        </button>
      </header>

      {doc ? (
        <div className="brand-dock__body">
          <section>
            <h4 className="brand-dock__label">Colours</h4>
            {doc.palette.length > 0 ? (
              <div className="brand-dock__swatches">
                {doc.palette.map((p) => (
                  <button
                    aria-label={`Copy ${p.name || p.value}`}
                    className="brand-dock__swatch"
                    key={p.value}
                    onClick={() => copy(p.value)}
                    style={{ background: p.value }}
                    title={`${p.name || p.value}${p.role ? ` · ${p.role}` : ""} — ${p.value}`}
                    type="button"
                  />
                ))}
              </div>
            ) : (
              <p className="brand-dock__empty">No colours in this kit yet.</p>
            )}
          </section>

          {doc.logos.length > 0 ? (
            <section>
              <h4 className="brand-dock__label">Logos</h4>
              <div className="brand-dock__grid">
                {doc.logos.map((logo) => (
                  <button
                    className="brand-dock__tile brand-dock__tile--logo"
                    key={logo.url}
                    onClick={() =>
                      onInsert({ imageUrl: logo.url, thumbUrl: logo.url })
                    }
                    title={logo.rules || logo.label || "Add to board"}
                    type="button"
                  >
                    <img
                      alt={logo.label}
                      height={96}
                      src={logo.url}
                      width={96}
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {doc.typefaces.length > 0 ? (
            <section>
              <h4 className="brand-dock__label">Type</h4>
              <ul className="brand-dock__list">
                {doc.typefaces.map((t) => (
                  <li key={t.name}>
                    <span style={{ fontFamily: t.name }}>{t.name}</span>
                    {t.role ? <small> · {t.role}</small> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="brand-dock__label">Library</h4>
            {doc.libraryCollectionId ? (
              <Library
                collectionId={doc.libraryCollectionId}
                onInsert={onInsert}
              />
            ) : (
              <p className="brand-dock__empty">
                No image library linked. Pick one in Brand kits.
              </p>
            )}
          </section>

          {doc.references.length > 0 ? (
            <section>
              <h4 className="brand-dock__label">References</h4>
              <ul className="brand-dock__list">
                {doc.references.map((r) => (
                  <li key={r.id}>
                    <button
                      aria-expanded={openRef === r.id}
                      className="brand-dock__ref"
                      onClick={() =>
                        setOpenRef((cur) => (cur === r.id ? null : r.id))
                      }
                      type="button"
                    >
                      {r.title || r.body.slice(0, 60)}
                      {r.date ? <small> · {r.date}</small> : null}
                    </button>
                    {openRef === r.id ? (
                      <div className="brand-dock__ref-body">
                        <p>{r.body}</p>
                        {r.source ? <small>Source: {r.source}</small> : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="brand-dock__empty brand-dock__body">
          Pick a brand to see its colours, logos and library here. Its colours
          also become the swatches in every colour picker on this board.
        </p>
      )}
    </aside>
  );
}
