import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ImageHit, imagesApi } from "../../services/libraryService";
import type { BrandDockInsert } from "./BrandDock";

/**
 * Finding references in the library and every collection by colour and
 * mood: "warm amber", "#041045", "brutalist poster". A click places one.
 * Images saved before search existed are described in the background; the
 * count says how many aren't searchable yet, with a button to do them now.
 */

const WAIT_MS = 350;

function Describe({ left, onDone }: { left: number; onDone: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  if (left === 0) {
    return null;
  }
  const run = async () => {
    setBusy(left);
    try {
      for (let pass = 0; pass < 400; pass += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: each pass is the server's next batch
        const step = await imagesApi.describe();
        setBusy(step.left);
        if (step.left === 0 || step.described === 0) {
          break;
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't describe them."
      );
    } finally {
      setBusy(null);
      onDone();
    }
  };
  return (
    <p className="brand-dock__empty">
      {busy === null
        ? `${left} image${left === 1 ? " isn't" : "s aren't"} searchable by colour and mood yet.`
        : `Describing… ${busy} to go.`}{" "}
      {busy === null ? (
        <Button onClick={() => void run()} size="xs" variant="ghost">
          Describe them
        </Button>
      ) : null}
    </p>
  );
}

export function ReferenceSearch({
  onInsert,
}: {
  onInsert: (image: BrandDockInsert) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ImageHit[] | null>(null);
  const [left, setLeft] = useState(0);
  const refreshLeft = () => void imagesApi.pending().then(setLeft);

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the panel opens
  useEffect(refreshLeft, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      imagesApi
        .search(q)
        .then((found) => live && setHits(found))
        .catch(() => live && setHits([]));
    }, WAIT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section>
      <h4 className="brand-dock__label">Find references</h4>
      <Input
        aria-label="Search references by colour or mood"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="warm amber, #041045, moody poster…"
        size="sm"
        value={query}
      />
      {hits && hits.length === 0 ? (
        <p className="brand-dock__empty">Nothing matches that yet.</p>
      ) : null}
      {hits && hits.length > 0 ? (
        <div className="brand-dock__grid">
          {hits.map((hit) => (
            <button
              className="brand-dock__tile"
              key={`${hit.source}-${hit.id}`}
              onClick={() => onInsert({ imageUrl: hit.url, thumbUrl: hit.url })}
              title={hit.description ?? hit.title ?? "Add to board"}
              type="button"
            >
              <img
                alt={hit.title ?? ""}
                height={96}
                loading="lazy"
                src={hit.url}
                width={96}
              />
            </button>
          ))}
        </div>
      ) : null}
      <Describe left={left} onDone={refreshLeft} />
    </section>
  );
}
