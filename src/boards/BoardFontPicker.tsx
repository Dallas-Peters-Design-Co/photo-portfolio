import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fontRefStack, parseFontRef } from "../../config/fontRef";
import { findFont } from "../../config/theme";
import {
  loadFontPreview,
  loadFontRef,
  loadFontsharePreview,
} from "../theme/remoteFonts";
import {
  type BoardFontOption,
  boardFontLabel,
  useBoardFontCatalog,
} from "./hooks/useBoardFontCatalog";
import "./BoardFontPicker.css";

const PAGE_SIZE = 40;
const SOURCES = ["All", "Google Fonts", "Fontshare"] as const;
type Source = (typeof SOURCES)[number];

const stackOf = (value: string | null): string | undefined => {
  const ref = parseFontRef(value);
  return ref ? fontRefStack(ref) : findFont(value ?? "")?.stack;
};

/** Only the visible remote font names need preview stylesheets. */
const preview = (option: BoardFontOption) => {
  const ref = parseFontRef(option.value);
  if (ref?.source === "google") {
    loadFontPreview(ref.family);
  } else if (ref?.source === "fontshare" && ref.slug) {
    loadFontsharePreview(ref.slug, option.weight);
  } else if (ref) {
    loadFontRef(option.value);
  }
};

interface Catalog {
  error: unknown;
  isLoading: boolean;
  mutate: () => Promise<unknown>;
}

/** Loading and failure for one catalog; both can be true while SWR retries. */
function CatalogStatus({ catalog, name }: { catalog: Catalog; name: string }) {
  return (
    <>
      {catalog.isLoading ? (
        <p className="board-font-picker__status">Loading {name}…</p>
      ) : null}
      {catalog.error ? (
        <p className="board-font-picker__status">
          Couldn't load {name}.{" "}
          <button
            onClick={() => {
              void catalog.mutate();
            }}
            type="button"
          >
            Retry {name}
          </button>
        </p>
      ) : null}
    </>
  );
}

export function BoardFontPicker({
  onChange,
  value,
}: {
  onChange: (family: string | null) => void;
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("All");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { fontshare, google, options } = useBoardFontCatalog(open);
  const currentLabel =
    options.find((option) => option.value === value)?.label ??
    boardFontLabel(value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        (source === "All" || source === option.source) &&
        option.label.toLowerCase().includes(needle)
    );
  }, [options, query, source]);
  const shown = useMemo(() => matches.slice(0, limit), [limit, matches]);

  useEffect(() => {
    if (open) {
      for (const option of shown) {
        preview(option);
      }
    }
  }, [open, shown]);

  const resetList = () => {
    setLimit(PAGE_SIZE);
    list.current?.scrollTo({ top: 0 });
  };
  const choose = (family: string | null) => {
    onChange(family);
    setOpen(false);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    const buttons = Array.from(
      popup.current?.querySelectorAll<HTMLButtonElement>(
        "[data-font-option]"
      ) ?? []
    );
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement
    );
    if (event.key === "Enter" && event.target === search.current) {
      event.preventDefault();
      buttons[0]?.click();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? current + 1 : current - 1;
      buttons[Math.max(0, Math.min(next, buttons.length - 1))]?.focus();
    }
  };

  return (
    <Popover.Root
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          resetList();
        }
      }}
      open={open}
    >
      <Popover.Trigger
        aria-label="Font"
        className="board-font-picker__trigger"
        title={currentLabel}
      >
        <span>{currentLabel}</span>
        <ChevronDown aria-hidden size={12} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="start"
          className="board-font-picker__positioner"
          sideOffset={4}
        >
          <Popover.Popup
            aria-label="Choose font"
            className="board-font-picker"
            initialFocus={search}
            onKeyDown={keyDown}
            onPointerDown={(event) => event.stopPropagation()}
            ref={popup}
          >
            <input
              aria-label="Search fonts"
              autoComplete="off"
              className="board-font-picker__search"
              onChange={(event) => {
                setQuery(event.target.value);
                resetList();
              }}
              placeholder="Search all Google Fonts and Fontshare…"
              ref={search}
              type="search"
              value={query}
            />
            <fieldset
              aria-label="Font source"
              className="board-font-picker__sources"
            >
              {SOURCES.map((name) => (
                <button
                  aria-pressed={source === name}
                  key={name}
                  onClick={() => {
                    setSource(name);
                    resetList();
                  }}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </fieldset>
            <p aria-live="polite" className="board-font-picker__status">
              {matches.length.toLocaleString()} fonts
            </p>
            <CatalogStatus catalog={google} name="Google Fonts" />
            <CatalogStatus catalog={fontshare} name="Fontshare" />
            <ul
              aria-label="Fonts"
              className="board-font-picker__list"
              ref={list}
            >
              {shown.map((option) => (
                <li key={`${option.source}:${option.value}`}>
                  <button
                    aria-pressed={value === option.value}
                    className="board-font-picker__option"
                    data-font-option
                    onClick={() => choose(option.value)}
                    type="button"
                  >
                    <span
                      style={{
                        fontFamily: stackOf(option.value),
                        fontWeight: option.weight,
                      }}
                    >
                      {option.label}
                    </span>
                    <small>{option.source}</small>
                  </button>
                </li>
              ))}
              {shown.length < matches.length ? (
                <li>
                  <button
                    className="board-font-picker__more"
                    onClick={() => setLimit(limit + PAGE_SIZE)}
                    type="button"
                  >
                    Show more fonts ({matches.length - shown.length})
                  </button>
                </li>
              ) : null}
              {matches.length === 0 ? (
                <li className="board-font-picker__status">
                  No matching fonts.
                </li>
              ) : null}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
