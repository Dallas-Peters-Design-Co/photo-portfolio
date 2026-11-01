import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { usePhotos } from "../../hooks/usePhotos";
import { collectionsApi } from "../../services/libraryService";
import {
  boardsApi,
  type FalLibraryItem,
  falLibraryApi,
  type PinResult,
  pinterestApi,
} from "../../services/portfolioService";
import { Button } from "../ui/button";

/**
 * Where a brand's reference pictures can come from: the brand's own library
 * collection, the photo library, the fal.ai generation history, or a
 * Pinterest board or pin. Pictures from fal and Pinterest are copied into our
 * own storage first, since their links expire or can't be read back.
 */

type Tab = "brand" | "fal" | "photos" | "pinterest";

interface Pick {
  id: string;
  /** Turns the picture into a durable address of ours. */
  resolve: () => Promise<string>;
  thumb: string;
  /** For "already added": the address as it would be stored, when known. */
  url: string | null;
}

const kept = (url: string) => () => Promise.resolve(url);

function Grid({
  items,
  onPick,
  taken,
}: {
  items: Pick[];
  onPick: (p: Pick) => void;
  taken: Set<string>;
}) {
  return (
    <div className="brand-images__grid">
      {items.map((p) => {
        const added = p.url !== null && taken.has(p.url);
        return (
          <button
            aria-label={added ? "Already added" : "Add this image"}
            aria-pressed={added}
            className="brand-images__pick"
            disabled={added}
            key={p.id}
            onClick={() => onPick(p)}
            type="button"
          >
            <img alt="" height={96} loading="lazy" src={p.thumb} width={96} />
          </button>
        );
      })}
    </div>
  );
}

function FalTab({
  onPick,
  taken,
}: {
  onPick: (p: Pick) => void;
  taken: Set<string>;
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FalLibraryItem[]>([]);
  const { data, error, isLoading } = useSWR(["fal-library", page], async () => {
    const next = await falLibraryApi.list(page);
    setItems((was) => (page === 1 ? next.items : [...was, ...next.items]));
    return next;
  });
  const images = items.filter((i) =>
    (i.contentType ?? "image").startsWith("image")
  );
  return (
    <>
      {error ? (
        <p className="brand-kit__hint">Couldn't read the fal.ai library.</p>
      ) : null}
      <Grid
        items={images.map((item) => ({
          id: item.id,
          resolve: () => falLibraryApi.adopt(item),
          thumb: item.previewUrl,
          url: null,
        }))}
        onPick={onPick}
        taken={taken}
      />
      {data?.hasMore ? (
        <Button
          disabled={isLoading}
          onClick={() => setPage((p) => p + 1)}
          type="button"
          variant="ghost"
        >
          {isLoading ? "Loading…" : "More"}
        </Button>
      ) : null}
    </>
  );
}

function PinterestTab({
  onPick,
  onPickAll,
  taken,
}: {
  onPick: (p: Pick) => void;
  onPickAll: (ps: Pick[]) => void;
  taken: Set<string>;
}) {
  const [link, setLink] = useState("");
  const [pins, setPins] = useState<PinResult[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const url = link.trim();
    if (!url) {
      return;
    }
    setLoading(true);
    try {
      if (url.includes("/pin/") || url.includes("pin.it/")) {
        const pin = await pinterestApi.resolve(url);
        setPins([pin]);
        setTitle(null);
      } else {
        const board = await pinterestApi.board(url);
        setPins(board.pins);
        setTitle(board.title);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setLoading(false);
    }
  };

  const picks = pins.map((pin) => ({
    id: pin.creditUrl || pin.imageUrl,
    resolve: () => boardsApi.adopt(pin.imageUrl),
    thumb: pin.thumbUrl ?? pin.imageUrl,
    url: null,
  }));

  return (
    <>
      <div className="row row--snug">
        <input
          aria-label="Pinterest board or pin link"
          className="admin-control"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void load();
            }
          }}
          placeholder="Paste a Pinterest board or pin link"
          value={link}
        />
        <Button
          disabled={loading}
          onClick={() => void load()}
          type="button"
          variant="outline"
        >
          {loading ? "Reading…" : "Load"}
        </Button>
      </div>
      {pins.length > 1 ? (
        <div className="row row--between">
          <span className="brand-kit__hint">
            {title ? `${title} · ` : ""}
            {pins.length} pins (a board's feed shows its most recent)
          </span>
          <Button
            onClick={() => onPickAll(picks)}
            type="button"
            variant="ghost"
          >
            Add all
          </Button>
        </div>
      ) : null}
      <Grid items={picks} onPick={onPick} taken={taken} />
    </>
  );
}

export function BrandImagePicker({
  collectionId,
  onAdd,
  taken,
}: {
  collectionId: string | null;
  /** Called with the durable address of each picture chosen. */
  onAdd: (url: string) => void;
  taken: Set<string>;
}) {
  const [tab, setTab] = useState<Tab>(collectionId ? "brand" : "photos");
  const [adding, setAdding] = useState(0);
  const { photos, isLoading: photosLoading } = usePhotos(tab === "photos");
  const { data: collection, isLoading: brandLoading } = useSWR(
    tab === "brand" && collectionId ? ["collection", collectionId] : null,
    () => collectionsApi.get(collectionId as string)
  );

  const pick = async (p: Pick) => {
    setAdding((n) => n + 1);
    try {
      onAdd(await p.resolve());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that picture");
    } finally {
      setAdding((n) => n - 1);
    }
  };

  const tabs: [Tab, string][] = [
    ...(collectionId ? ([["brand", "Brand library"]] as [Tab, string][]) : []),
    ["photos", "Photos"],
    ["fal", "fal.ai"],
    ["pinterest", "Pinterest"],
  ];

  const libraryPicks: Pick[] =
    tab === "brand"
      ? (collection?.items ?? [])
          .filter((item) => item.kind === "image")
          .map((item) => ({
            id: item.id,
            resolve: kept(item.url),
            thumb: item.url,
            url: item.url,
          }))
      : photos.map((p) => {
          const url = p.originalUrl ?? p.url;
          return { id: p.id, resolve: kept(url), thumb: p.url, url };
        });
  const libraryLoading = tab === "brand" ? brandLoading : photosLoading;

  return (
    <div className="brand-images__picker">
      <div className="brand-images__tabs">
        {tabs.map(([id, label]) => (
          <button
            aria-pressed={tab === id}
            key={id}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
        {adding > 0 ? (
          <span className="brand-kit__hint">Adding {adding}…</span>
        ) : null}
      </div>
      {tab === "fal" ? (
        <FalTab onPick={(p) => void pick(p)} taken={taken} />
      ) : null}
      {tab === "pinterest" ? (
        <PinterestTab
          onPick={(p) => void pick(p)}
          onPickAll={(ps) => {
            for (const p of ps) {
              void pick(p);
            }
          }}
          taken={taken}
        />
      ) : null}
      {tab === "brand" || tab === "photos" ? (
        <>
          {libraryLoading ? <p className="brand-kit__hint">Loading…</p> : null}
          {!libraryLoading && libraryPicks.length === 0 ? (
            <p className="brand-kit__hint">Nothing here yet.</p>
          ) : null}
          <Grid
            items={libraryPicks}
            onPick={(p) => void pick(p)}
            taken={taken}
          />
        </>
      ) : null}
    </div>
  );
}
