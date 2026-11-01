import { ImagePlus, Library, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  type BrandKitDoc,
  MAX_OFFBRAND,
  MAX_ONBRAND,
} from "../../../config/brandKit.js";
import { usePhotos } from "../../hooks/usePhotos";
import { collectionsApi } from "../../services/libraryService";
import { portfolioService } from "../../services/portfolioService";
import { Button } from "../ui/button";
import "./BrandImagesEditor.css";

/**
 * A kit's reference images: what the brand looks like ("This") and what it
 * doesn't ("Not this"). Added by uploading or by picking from the brand's
 * image library or the photo library; shown on the brand guide and sent to
 * models as examples.
 */

type Which = "offBrand" | "onBrand";

const LIMIT: Record<Which, number> = {
  offBrand: MAX_OFFBRAND,
  onBrand: MAX_ONBRAND,
};

function Picker({
  collectionId,
  onPick,
  taken,
}: {
  collectionId: string | null;
  onPick: (url: string) => void;
  taken: Set<string>;
}) {
  const [tab, setTab] = useState<"brand" | "photos">(
    collectionId ? "brand" : "photos"
  );
  const { photos, isLoading: photosLoading } = usePhotos(tab === "photos");
  const { data: collection, isLoading: brandLoading } = useSWR(
    tab === "brand" && collectionId ? ["collection", collectionId] : null,
    () => collectionsApi.get(collectionId as string)
  );
  const images =
    tab === "brand"
      ? (collection?.items ?? [])
          .filter((item) => item.kind === "image")
          .map((item) => ({ id: item.id, thumb: item.url, url: item.url }))
      : photos.map((p) => ({
          id: p.id,
          thumb: p.url,
          url: p.originalUrl ?? p.url,
        }));
  const loading = tab === "brand" ? brandLoading : photosLoading;

  return (
    <div className="brand-images__picker">
      <div className="brand-images__tabs">
        {collectionId ? (
          <button
            aria-pressed={tab === "brand"}
            onClick={() => setTab("brand")}
            type="button"
          >
            Brand library
          </button>
        ) : null}
        <button
          aria-pressed={tab === "photos"}
          onClick={() => setTab("photos")}
          type="button"
        >
          Photos
        </button>
      </div>
      {loading ? <p className="brand-kit__hint">Loading…</p> : null}
      {!loading && images.length === 0 ? (
        <p className="brand-kit__hint">Nothing here yet.</p>
      ) : null}
      <div className="brand-images__grid">
        {images.map((img) => {
          const added = taken.has(img.url);
          return (
            <button
              aria-label={added ? "Already added" : "Add this image"}
              aria-pressed={added}
              className="brand-images__pick"
              disabled={added}
              key={img.id}
              onClick={() => onPick(img.url)}
              type="button"
            >
              <img
                alt=""
                height={96}
                loading="lazy"
                src={img.thumb}
                width={96}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImageSet({
  doc,
  label,
  onChange,
  which,
}: {
  doc: BrandKitDoc;
  label: string;
  onChange: (next: BrandKitDoc) => void;
  which: Which;
}) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const urls = doc[which];
  const full = urls.length >= LIMIT[which];
  // Read the latest doc when several uploads finish one after another.
  const latest = useRef(doc);
  latest.current = doc;

  const add = (url: string) => {
    const current = latest.current[which];
    if (current.includes(url) || current.length >= LIMIT[which]) {
      return;
    }
    const next = { ...latest.current, [which]: [...current, url] };
    latest.current = next;
    onChange(next);
  };

  const upload = async (files: File[]) => {
    const room = LIMIT[which] - urls.length;
    const chosen = files.slice(0, Math.max(0, room));
    if (chosen.length < files.length) {
      toast.error(`${LIMIT[which]} images is the most a set can hold`);
    }
    setUploading((n) => n + chosen.length);
    await Promise.all(
      chosen.map(async (file) => {
        try {
          const { url } = await portfolioService.uploadImageFile(
            file,
            undefined,
            "brand-kits/references"
          );
          add(url);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : `Couldn't upload ${file.name}`
          );
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
  };

  return (
    <div className="brand-images__set stack stack--snug">
      <div className="row row--between">
        <span className="brand-images__label">
          {label}
          <small>
            {urls.length} / {LIMIT[which]}
          </small>
        </span>
        <div className="row row--snug">
          <Button
            disabled={full || uploading > 0}
            onClick={() => input.current?.click()}
            type="button"
            variant="ghost"
          >
            <Upload size={14} />
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload"}
          </Button>
          <Button
            aria-pressed={picking}
            disabled={full}
            onClick={() => setPicking((v) => !v)}
            type="button"
            variant="ghost"
          >
            <Library size={14} /> From library
          </Button>
        </div>
      </div>
      <input
        accept="image/*"
        hidden
        multiple
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        ref={input}
        type="file"
      />
      {urls.length > 0 ? (
        <div className="brand-images__grid">
          {urls.map((url) => (
            <figure className="brand-images__item" key={url}>
              <img alt="" height={96} loading="lazy" src={url} width={96} />
              <button
                aria-label="Remove image"
                className="brand-images__remove"
                onClick={() =>
                  onChange({ ...doc, [which]: urls.filter((u) => u !== url) })
                }
                type="button"
              >
                <X size={12} />
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <button
          className="brand-images__empty"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(Array.from(e.dataTransfer.files));
          }}
          type="button"
        >
          <ImagePlus size={16} />
          Drop images here, upload, or pick from your library
        </button>
      )}
      {picking ? (
        <Picker
          collectionId={doc.libraryCollectionId}
          onPick={add}
          taken={new Set(urls)}
        />
      ) : null}
    </div>
  );
}

export function BrandImagesEditor({
  doc,
  onChange,
}: {
  doc: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  return (
    <div className="stack stack--mid">
      <ImageSet
        doc={doc}
        label="This: on brand"
        onChange={onChange}
        which="onBrand"
      />
      <ImageSet
        doc={doc}
        label="Not this: off brand"
        onChange={onChange}
        which="offBrand"
      />
    </div>
  );
}
