import { Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  const [items, setItems] = useState<FalLibraryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetched on every mount rather than through a shared cache: the tab keeps
  // its own pages, and a cached first page would leave it holding nothing.
  const load = useCallback(async (next: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await falLibraryApi.list(next);
      setItems((was) =>
        next === 1 ? result.items : [...was, ...result.items]
      );
      setHasMore(result.hasMore);
      setPage(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read fal.ai");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const images = items.filter((i) => isImage(i));
  return (
    <>
      {error ? (
        <div className="brand-images__note">
          <span>{error}</span>
          <Button
            onClick={() => void load(1)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {!(error || loading) && images.length === 0 ? (
        <p className="brand-images__note">
          Nothing generated on this fal account in the last 90 days.
        </p>
      ) : null}
      <Grid
        items={images.map((item) => ({
          id: item.id,
          resolve: () => falLibraryApi.adopt(item),
          thumb: item.previewUrl || item.url,
          url: null,
        }))}
        onPick={onPick}
        taken={taken}
      />
      {loading ? <p className="brand-images__note">Loading…</p> : null}
      {hasMore && !loading ? (
        <Button
          onClick={() => void load(page + 1)}
          size="sm"
          type="button"
          variant="ghost"
        >
          More
        </Button>
      ) : null}
    </>
  );
}

const NOT_IMAGE = /\.(mp4|webm|mov|mp3|wav)(\?|$)/i;

/** fal lists video and audio too; a missing type is taken from the address. */
const isImage = (item: FalLibraryItem) =>
  item.contentType
    ? item.contentType.startsWith("image")
    : !NOT_IMAGE.test(item.url);

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
      <form
        className="brand-images__link"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Link2 aria-hidden size={14} />
        <input
          aria-label="Pinterest board or pin link"
          onChange={(e) => setLink(e.target.value)}
          placeholder="Pinterest board or pin link"
          type="url"
          value={link}
        />
        <button disabled={loading || !link.trim()} type="submit">
          {loading ? "Reading…" : "Load"}
        </button>
      </form>
      {pins.length === 0 && !loading ? (
        <p className="brand-images__note">
          Paste a board link to see its latest pins, or a single pin.
        </p>
      ) : null}
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
