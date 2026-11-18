import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type BrandMerge,
  EMPTY_MERGE,
  hasMergeWriteup,
  MAX_MERGE_OPTIONS,
  type MergeImage,
} from "../../../config/brandMerge.js";
import { useBrandKits } from "../../hooks/useBrandKits";
import { useCollections } from "../../hooks/useCollections";
import type { BrandKit } from "../../services/brandKitService";
import { boardsApi } from "../../services/portfolioService";
import type { Board, BoardItem } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  CollectionPictures,
  type PictureSlot,
} from "./reviewMerge/CollectionPictures";
import { MergeWriteupFields } from "./reviewMerge/MergeWriteupFields";
import { frameImage, framesOf } from "./reviewMerge/mergeFrames";
import { useMergeWriter } from "./reviewMerge/useMergeWriter";
import "./ReviewMergeEditor.css";
import { EditorBlock } from "./EditorBlock";

/**
 * A review's brand merge writeup (config/brandMerge.ts): two brand kits, the
 * options to present, the eve agent writing the comparison and each option,
 * and frames from the review's board as its pictures. Read at
 * /review/:slug/merge, behind the review's password.
 */

type Update = (update: (merge: BrandMerge) => BrandMerge) => void;

type MergeOption = BrandMerge["options"][number];

// Options carry no id, so each gets a React key the first time it is drawn,
// and an edit hands its key on to the object that replaces it. Removing an
// option then drops its own row rather than the last one.
const optionKeys = new WeakMap<MergeOption, string>();
let nextOptionKey = 0;

const keyOf = (option: MergeOption): string => {
  let key = optionKeys.get(option);
  if (!key) {
    nextOptionKey += 1;
    key = `option-${nextOptionKey}`;
    optionKeys.set(option, key);
  }
  return key;
};

const replaceOption = (from: MergeOption, to: MergeOption): MergeOption => {
  optionKeys.set(to, keyOf(from));
  return to;
};

function KitPicker({
  id,
  label,
  logo,
  onChange,
  onLogo,
  value,
}: {
  id: string;
  label: string;
  /** The logo the page shows for this brand. */
  logo: string | null;
  onChange: (id: string | null) => void;
  onLogo: (url: string) => void;
  value: string | null;
}) {
  const { kits } = useBrandKits();
  const logos = logosOf(kits, value);
  const items = [
    { label: "Pick a brand kit", value: "" },
    ...kits.map((kit) => ({
      label: kit.parentName ? `${kit.parentName} / ${kit.name}` : kit.name,
      value: kit.id,
    })),
  ];
  return (
    <div className="review-merge__field">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        onValueChange={(next) => onChange(next || null)}
        value={value ?? ""}
      >
        <SelectTrigger id={id} size="lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {logos.length > 1 ? (
        <div className="review-merge__logos">
          {/* On the page's own dark ground, so a dark mark shows it won't read. */}
          {logos.map((l) => (
            <button
              aria-label={`Use ${l.label || "this logo"} for ${label}`}
              aria-pressed={l.url === logo}
              className="review-merge__logo-choice"
              key={l.url}
              onClick={() => onLogo(l.url)}
              title={l.label}
              type="button"
            >
              <img alt="" height={32} src={l.url} width={96} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OptionNames({ merge, update }: { merge: BrandMerge; update: Update }) {
  const rename = (i: number, name: string) =>
    update((m) => ({
      ...m,
      options: m.options.map((o, k) =>
        k === i ? replaceOption(o, { ...o, name }) : o
      ),
    }));
  return (
    <div className="review-merge__field">
      <span className="review-merge__label">Options to present</span>
      {merge.options.map((option, i) => (
        <div className="review-merge__row" key={keyOf(option)}>
          <Input
            aria-label={`Option ${i + 1}`}
            onChange={(e) => rename(i, e.target.value)}
            placeholder="e.g. RoleModel absorbs Acme"
            value={option.name}
          />
          <Button
            aria-label={`Remove option ${i + 1}`}
            onClick={() =>
              update((m) => ({
                ...m,
                options: m.options.filter((_, k) => k !== i),
              }))
            }
            size="icon"
            type="button"
            variant="ghost"
          >
            <X size={14} />
          </Button>
        </div>
      ))}
      {merge.options.length < MAX_MERGE_OPTIONS ? (
        <div>
          <Button
            onClick={() =>
              update((m) => ({
                ...m,
                options: [
                  ...m.options,
                  {
                    changes: [],
                    how: "",
                    image: null,
                    keeps: [],
                    name: "",
                    risks: [],
                    summary: "",
                    when: "",
                  },
                ],
              }))
            }
            type="button"
            variant="ghost"
          >
            <Plus size={14} /> Add option
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One picture slot: a frame from the board, or none. */
function FramePicker({
  frames,
  image,
  items,
  label,
  onChange,
}: {
  frames: BoardItem[];
  image: MergeImage | null;
  items: BoardItem[];
  label: string;
  onChange: (image: MergeImage | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const choices = [
    { label: "No picture", value: "" },
    ...frames.map((f) => ({
      label: f.body?.trim() || "Untitled frame",
      value: f.id,
    })),
  ];
  const pick = async (id: string | null) => {
    const frame = frames.find((f) => f.id === id);
    if (!frame) {
      onChange(null);
      return;
    }
    setBusy(true);
    try {
      onChange(await frameImage(frame, items));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't use that frame."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="review-merge__picture">
      {image ? (
        <img
          alt=""
          className="review-merge__thumb"
          height={image.height}
          src={image.url}
          width={image.width}
        />
      ) : (
        <span className="review-merge__thumb review-merge__thumb--empty" />
      )}
      <div className="review-merge__field">
        <span className="review-merge__label">
          {label}
          {busy ? " · drawing…" : ""}
        </span>
        <Select items={choices} onValueChange={(v) => void pick(v)} value="">
          <SelectTrigger aria-label={`${label} frame`}>
            <SelectValue
              placeholder={image ? "Change frame" : "Pick a frame"}
            />
          </SelectTrigger>
          <SelectContent>
            {choices.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** The board the pictures come from: any board, the review's own by default. */
const COLLECTION = "collection:";

/** Where the pictures come from: the review's board, another board, or a collection. */
function SourcePicker({
  merge,
  reviewBoardId,
  update,
}: {
  merge: BrandMerge;
  reviewBoardId: string | null;
  update: Update;
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const { collections } = useCollections();
  useEffect(() => {
    let live = true;
    boardsApi
      .list()
      .then((list) => live && setBoards(list))
      .catch(() => live && setBoards([]));
    return () => {
      live = false;
    };
  }, []);
  const items = [
    {
      label: reviewBoardId ? "The review's board" : "Pick a board",
      value: "",
    },
    ...boards
      .filter((b) => b.id !== reviewBoardId)
      .map((b) => ({ label: b.title || "Untitled board", value: b.id })),
    ...collections.map((c) => ({
      label: `Collection: ${c.name}`,
      value: `${COLLECTION}${c.id}`,
    })),
  ];
  const value = merge.collectionId
    ? `${COLLECTION}${merge.collectionId}`
    : (merge.boardId ?? "");
  return (
    <div className="review-merge__field">
      <Label htmlFor="merge-board">Pictures from</Label>
      <Select
        items={items}
        onValueChange={(next) => {
          const picked = next ?? "";
          update((m) =>
            picked.startsWith(COLLECTION)
              ? { ...m, collectionId: picked.slice(COLLECTION.length) }
              : { ...m, boardId: picked || null, collectionId: null }
          );
        }}
        value={value}
      >
        <SelectTrigger id="merge-board" size="lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The hero and each option's picture, as slots either picker fills. */
const slotsOf = (merge: BrandMerge, update: Update): PictureSlot[] => [
  {
    image: merge.hero,
    key: "hero",
    label: "Hero picture",
    onChange: (hero) => update((m) => ({ ...m, hero })),
  },
  ...merge.options.map((option, i) => ({
    image: option.image,
    key: keyOf(option),
    label: option.name || `Option ${i + 1}`,
    onChange: (image: MergeImage | null) =>
      update((m) => ({
        ...m,
        options: m.options.map((o, k) =>
          k === i ? replaceOption(o, { ...o, image }) : o
        ),
      })),
  })),
];

function Pictures({
  boardId,
  merge,
  update,
}: {
  boardId: string | null;
  merge: BrandMerge;
  update: Update;
}) {
  const [items, setItems] = useState<BoardItem[]>([]);
  useEffect(() => {
    if (!boardId) {
      return;
    }
    let live = true;
    boardsApi
      .get(boardId)
      .then((board) => live && setItems(board.items ?? []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [boardId]);
  if (!boardId) {
    return (
      <p className="review-merge__hint">
        Pick a board to use its frames as the pictures.
      </p>
    );
  }
  const frames = framesOf(items);
  return (
    <div className="review-merge__pictures">
      {slotsOf(merge, update).map((slot) => (
        <FramePicker
          frames={frames}
          image={slot.image}
          items={items}
          key={slot.key}
          label={slot.label}
          onChange={slot.onChange}
        />
      ))}
    </div>
  );
}

/** The kit's logos, as the merge can show them. */
const logosOf = (kits: BrandKit[], id: string | null) =>
  kits.find((k) => k.id === id)?.resolvedDoc.logos ?? [];

/**
 * The logo the merge shows for a kit: the one chosen, while the kit still
 * has it, else its first. A light mark is often not the first, and the page
 * is dark.
 */
const logoOf = (
  kits: BrandKit[],
  id: string | null,
  chosen: string | null
): string | null => {
  const logos = logosOf(kits, id);
  return logos.find((l) => l.url === chosen)?.url ?? logos[0]?.url ?? null;
};

/**
 * Each kit's chosen logo (its first until one is picked), copied onto the merge: the writeup's page is behind
 * the review's password, and can't read the kits themselves. Kept in step
 * when a kit is changed or its logo is.
 */
const useKitLogos = (merge: BrandMerge, update: Update) => {
  const { isLoading, kits } = useBrandKits();
  const logoA = logoOf(kits, merge.brandA, merge.logoA);
  const logoB = logoOf(kits, merge.brandB, merge.logoB);
  const stale = merge.logoA !== logoA || merge.logoB !== logoB;
  // biome-ignore lint/correctness/useExhaustiveDependencies: update is a fresh closure each render; the logos are what change
  useEffect(() => {
    if (!isLoading && kits.length > 0 && stale) {
      update((m) => ({ ...m, logoA, logoB }));
    }
  }, [isLoading, kits.length, stale, logoA, logoB]);
};

export function ReviewMergeEditor({
  boardId,
  collapsed,
  merge: stored,
  onChange,
  onToggle,
  slug,
}: {
  boardId: string | null;
  /** Folded away, like the editor's other blocks (EditorBlock). */
  collapsed: boolean;
  onToggle: () => void;
  merge: BrandMerge | null;
  /** Given the merge as it is when the change lands (the agent's answer arrives minutes later). */
  onChange: (update: (prev: BrandMerge | null) => BrandMerge | null) => void;
  slug: string;
}) {
  const merge = stored ?? EMPTY_MERGE;
  const update: Update = (fn) => onChange((prev) => fn(prev ?? EMPTY_MERGE));
  useKitLogos(merge, update);
  const { start, status } = useMergeWriter((writeup) =>
    update((m) => ({
      ...m,
      ...writeup,
      // Pictures chosen before the writing stay with their option.
      options: writeup.options.map((o) => ({
        ...o,
        image: m.options.find((p) => p.name === o.name)?.image ?? null,
      })),
    }))
  );
  const names = merge.options.map((o) => o.name.trim()).filter(Boolean);
  const ready =
    merge.brandA &&
    merge.brandB &&
    merge.brandA !== merge.brandB &&
    names.length > 0;
  const running = status.state === "running";

  return (
    <EditorBlock
      actions={
        hasMergeWriteup(stored) ? (
          <a
            className="review-merge__open"
            href={`/review/${slug}/merge`}
            rel="noopener"
            target="_blank"
          >
            Open the page
          </a>
        ) : null
      }
      collapsed={collapsed}
      onToggle={onToggle}
      title="Brand merge"
    >
      <div className="review-merge">
        <p className="review-merge__hint">
          Two brands, and the ways they could become one. The agent reads both
          kits and their websites and writes the comparison and each option. It
          has its own page, behind this review's password.
        </p>
        <div className="review-merge__kits">
          <KitPicker
            id="merge-a"
            label="Brand A"
            logo={merge.logoA}
            onChange={(brandA) => update((m) => ({ ...m, brandA }))}
            onLogo={(logoA) => update((m) => ({ ...m, logoA }))}
            value={merge.brandA}
          />
          <KitPicker
            id="merge-b"
            label="Brand B"
            logo={merge.logoB}
            onChange={(brandB) => update((m) => ({ ...m, brandB }))}
            onLogo={(logoB) => update((m) => ({ ...m, logoB }))}
            value={merge.brandB}
          />
        </div>
        <OptionNames merge={merge} update={update} />
        <div className="review-merge__write">
          <Button
            disabled={!ready || running}
            onClick={() =>
              merge.brandA && merge.brandB
                ? void start({
                    brandA: merge.brandA,
                    brandB: merge.brandB,
                    options: names,
                  })
                : undefined
            }
            type="button"
          >
            {merge.generatedAt ? "Write it again" : "Write it with the agent"}
          </Button>
          <span aria-live="polite" className="review-merge__hint">
            {status.state === "running"
              ? `${status.phase} This takes a few minutes.`
              : null}
            {status.state === "failed" ? status.error : null}
            {status.state === "idle" && !ready
              ? "Pick two brand kits and name at least one option."
              : null}
          </span>
        </div>
        {merge.generatedAt ? (
          <MergeWriteupFields merge={merge} update={update} />
        ) : null}
        <SourcePicker merge={merge} reviewBoardId={boardId} update={update} />
        {merge.collectionId ? (
          <CollectionPictures
            collectionId={merge.collectionId}
            slots={slotsOf(merge, update)}
          />
        ) : (
          <Pictures
            boardId={merge.boardId ?? boardId}
            merge={merge}
            update={update}
          />
        )}
      </div>
    </EditorBlock>
  );
}
