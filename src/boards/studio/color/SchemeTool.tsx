import {
  Copy,
  Download,
  FolderOpen,
  Link2,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_KIT_NAME } from "../../../../config/brandKit.js";
import { contrastRatio } from "../../../../config/theme.js";
import { formatOklch, hexToOklch } from "../../../lib/oklch";
import { ColorWell } from "../../ColorWell";
import { ImagePick } from "../ImagePick";
import { saveBlob, svgToPngBlob } from "../render";
import { paletteFromUrl } from "./harmony";
import { SchemeContrast } from "./SchemeContrast";
import { SchemeControls } from "./SchemeControls";
import { SchemeDials } from "./SchemeDials";
import { HueMap } from "./SchemeHueMap";
import { simulate, type Vision } from "./scheme";
import { arrangedPalette } from "./schemeArrangement";
import { roleLabel, STATUS_ROLES, schemePalette } from "./schemeRoles";
import { swatchesSvg } from "./swatches";
import { useKitPalette } from "./useKitPalette";
import { lchOf, useScheme } from "./useScheme";

/**
 * Palette Builder: a palette grown from one colour. Pick the anchor, say what
 * the palette is for (the model), where its other hues sit and how many of
 * them are neutrals. Click any colour to set it by hand with the dials or
 * the hue wheel, sync it back to the anchor, or lock it as it is. Save it as the brand's palette, put it on the board, or copy it
 * out as hex, OKLCH or CSS.
 */

const oklchOf = (hex: string) => {
  const c = hexToOklch(hex);
  return c ? formatOklch(c) : hex;
};

const cssOf = (colors: string[], roles: string[]) =>
  `:root {\n${colors
    .map(
      (c, i) =>
        `  --color-${roles[i]?.trim() && roles.indexOf(roles[i]) === i ? CSS.escape(roles[i].trim()) : i + 1}: ${oklchOf(c)}; /* ${c} */`
    )
    .join("\n")}\n}`;

export function SchemeTool({
  onAdd,
  selectedImage,
}: {
  onAdd: (file: File) => void;
  /** The picture selected on the board, offered first. */
  selectedImage?: string | null;
}) {
  const { kit } = useKitPalette();
  // Kept per brand kit, so each brand's palette in progress is its own; and
  // a fresh builder per kit, so it opens on that kit's (the kit can arrive
  // a moment after the Studio does).
  const key = `studio:scheme:${kit?.id ?? "none"}`;
  return (
    <SchemeBuilder
      key={key}
      onAdd={onAdd}
      selectedImage={selectedImage}
      storageKey={key}
    />
  );
}

/** Which kit Save writes to and Load reads from. */
function KitPicker({
  kits,
  onChange,
  value,
}: {
  kits: { id: string; name: string }[];
  onChange: (id: string) => void;
  value: string | undefined;
}) {
  return (
    <div className="studio__field">
      <span>Brand kit</span>
      <Select
        onValueChange={(next) => {
          if (next) {
            onChange(next);
          }
        }}
        value={value ?? ""}
      >
        <SelectTrigger
          aria-label="Brand kit to save to or load from"
          size="sm"
          tone="board"
        >
          <SelectValue placeholder="Choose a brand kit" />
        </SelectTrigger>
        <SelectContent>
          {kits.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SchemeBuilder({
  onAdd,
  selectedImage,
  storageKey,
}: {
  onAdd: (file: File) => void;
  selectedImage?: string | null;
  storageKey: string;
}) {
  const { entries, kit, kits, saving, updateFor } = useKitPalette();
  const scheme = useScheme(entries[0]?.value, storageKey);
  // Where Save writes and Load reads: the board's brand to start with, any
  // kit after. Changing it keeps the colours, so one brand's palette can be
  // loaded, the kit switched, and saved into another.
  const [targetId, setTargetId] = useState(kit?.id ?? "");
  const target =
    kits.find((candidate) => candidate.id === targetId) ?? kit ?? null;
  const { anchorAt, colors, locked, selected, settings } = scheme;
  const [vision, setVision] = useState<Vision>("none");

  const source = colors.map((value, i) => ({
    name: scheme.base?.[i]?.name ?? "",
    role: scheme.base?.[i]?.role ?? "",
    value,
  }));
  const roles = source.map((entry, i) => scheme.roles[i] ?? entry.role);
  const { arrangement, order } = scheme;
  const displayed = order.map((i) => colors[i]);
  const dragSlot = useRef<number | null>(null);
  const selectedPosition = order.indexOf(selected);
  const selectedGroup = arrangement.members[selected]?.group ?? "";
  const save = async () => {
    if (!target) {
      return;
    }
    const customized =
      arrangement.order.length > 0 ||
      Object.keys(arrangement.names).length > 0 ||
      Object.keys(arrangement.members).length > 0 ||
      scheme.base?.some((e) => e.group) ||
      arrangement.targetIds[target.id]?.some((id) =>
        target.resolvedDoc.palette.some((e) => e.id === id)
      );
    if (!customized) {
      await updateFor(
        target,
        {
          palette: schemePalette(
            target.resolvedDoc.palette,
            source,
            scheme.roles,
            target.id !== kit?.id
          ),
        },
        "palette"
      );
      return;
    }
    const result = arrangedPalette(
      target.resolvedDoc.palette,
      source,
      scheme.roles,
      arrangement,
      target.id,
      target.id !== kit?.id
    );
    if (await updateFor(target, { palette: result.palette }, "palette")) {
      scheme.setArrangement((was) => ({
        ...was,
        targetIds: { ...was.targetIds, [target.id]: result.ids },
      }));
    }
  };
  const selectedRole = roles[selected] ?? "";
  const nameOf = (i: number) => (i === anchorAt ? "Anchor" : `Colour ${i + 1}`);

  const swatchInk = (hex: string) =>
    contrastRatio(hex, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";
  const editLabel = (i: number) =>
    [nameOf(i).toLowerCase(), roles[i]].filter(Boolean).join(", ");
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${what} copied`);
  };

  /**
   * A picture's main colours, loaded like the brand's: the first becomes the
   * anchor, the rest are held as found, each then editable on the wheel and
   * the dials.
   */
  const fromPicture = async (url: string) => {
    try {
      const found = await paletteFromUrl(url, Math.max(colors.length, 5));
      scheme.loadBrand(found.map((value) => ({ name: "", role: "", value })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read it");
    }
  };

  const add = async () => {
    const { h, svg, w } = swatchesSvg([{ colors: displayed }]);
    const png = await svgToPngBlob(svg, w, h);
    onAdd(new File([png], "palette.png", { type: "image/png" }));
    toast.success("Palette added to the board");
  };

  return (
    <div className="studio-palette-tool">
      <div className="studio-palette studio-scheme__swatches">
        {order.map((i) => {
          const c = colors[i];
          const shown = simulate(c, vision);
          return (
            <div
              className="studio-palette__swatch"
              data-selected={i === selected ? "" : undefined}
              key={i}
              style={{ background: shown, color: swatchInk(shown) }}
            >
              <button
                aria-label={`Edit ${editLabel(i)}`}
                aria-pressed={i === selected}
                className="studio-palette__pick"
                disabled={!scheme.individual && i !== anchorAt}
                draggable
                onClick={() => scheme.select(i)}
                onDragEnd={() => {
                  dragSlot.current = null;
                }}
                onDragOver={(event) => {
                  if (dragSlot.current !== null) {
                    event.preventDefault();
                  }
                }}
                onDragStart={(event) => {
                  dragSlot.current = i;
                  event.dataTransfer.setData("text/plain", c);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragSlot.current !== null) {
                    scheme.move(dragSlot.current, i);
                  }
                  dragSlot.current = null;
                }}
                title={`${nameOf(i)}: click to set it with the dials`}
                type="button"
              />
              {i === anchorAt ? null : (
                <button
                  aria-label={locked[i] ? `Unlock ${c}` : `Lock ${c}`}
                  aria-pressed={Boolean(locked[i])}
                  className="studio-palette__tool"
                  onClick={() => scheme.toggleLock(i)}
                  type="button"
                >
                  {locked[i] ? <Lock size={15} /> : <LockOpen size={15} />}
                </button>
              )}
              <button
                className="studio-palette__hex"
                onClick={() => copy(c, c)}
                title={oklchOf(c)}
                type="button"
              >
                {c.slice(1).toUpperCase()}
              </button>
              {roles[i] ? (
                <span className="studio-scheme__semantic-name">
                  {roleLabel(roles[i])}
                </span>
              ) : null}
              {i === anchorAt ? (
                <span className="studio-scheme__anchor">Anchor</span>
              ) : null}
              <span className="studio-scheme__by-hand">
                {(arrangement.names[i] ?? source[i].name) ||
                  (scheme.held(i) ? "By hand" : "")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="studio-scheme">
        <div className="studio__controls">
          <div className="studio-scheme__picked">
            <strong>{nameOf(selected)}</strong>
            <ColorWell
              alpha={false}
              label={`${nameOf(selected)} colour`}
              onChange={(hex) => {
                const { c, h, l } = lchOf(hex);
                scheme.setColour(selected, { c, h, l });
              }}
              value={colors[selected] ?? scheme.anchor}
            />
            {scheme.held(selected) && !selectedGroup ? (
              <button
                className="studio__button"
                onClick={() => scheme.release(selected)}
                title="This colour follows the anchor and the settings again"
                type="button"
              >
                <Link2 size={14} /> Sync to anchor
              </button>
            ) : null}
            <label className="studio__check studio-scheme__switch">
              <input
                checked={scheme.individual}
                onChange={(e) => scheme.setIndividual(e.target.checked)}
                type="checkbox"
              />
              Individual colours
            </label>
          </div>
          <label className="studio__field">
            Semantic role
            <input
              aria-label="Semantic role"
              list="scheme-semantic-roles"
              maxLength={MAX_KIT_NAME}
              onChange={(event) => scheme.setRole(selected, event.target.value)}
              placeholder="Unassigned"
              value={selectedRole}
            />
            <datalist id="scheme-semantic-roles">
              {[...new Set([...STATUS_ROLES, ...roles.filter(Boolean)])].map(
                (role) => (
                  <option key={role} value={role} />
                )
              )}
            </datalist>
          </label>
          <label className="studio__field">
            Swatch name
            <input
              maxLength={MAX_KIT_NAME}
              onChange={(event) => {
                const name = event.target.value;
                scheme.setArrangement((was) => ({
                  ...was,
                  names: { ...was.names, [selected]: name },
                }));
              }}
              value={arrangement.names[selected] ?? source[selected].name}
            />
          </label>
          <label className="studio__field">
            Hue group
            <input
              defaultValue={selectedGroup}
              disabled={!scheme.individual}
              key={`${selected}-${selectedGroup}`}
              list="scheme-hue-groups"
              maxLength={MAX_KIT_NAME}
              onBlur={(event) => scheme.setGroup(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="Choose or name a group"
            />
          </label>
          <datalist id="scheme-hue-groups">
            {[
              ...new Set([
                "Status",
                ...Object.values(arrangement.members).map((m) => m.group),
              ]),
            ].map((group) => (
              <option key={group} value={group} />
            ))}
          </datalist>
          {selectedGroup.length > 0 && (
            <span>
              Lightness and chroma are shared with {selectedGroup}. Drag a wheel
              handle to change its hue.
            </span>
          )}
          <div className="studio__actions">
            <button
              className="studio__button"
              disabled={selectedPosition === 0}
              onClick={() => scheme.move(selected, order[selectedPosition - 1])}
              type="button"
            >
              Move left
            </button>
            <button
              className="studio__button"
              disabled={selectedPosition === order.length - 1}
              onClick={() => scheme.move(selected, order[selectedPosition + 1])}
              type="button"
            >
              Move right
            </button>
          </div>
          <SchemeDials
            name={nameOf(selected)}
            onChange={(next) => scheme.setColour(selected, next)}
            value={scheme.selectedLch}
          />
          <ImagePick
            label="From a picture"
            onPick={(url) => void fromPicture(url)}
            selectedImage={selectedImage}
          />
          <SchemeControls
            onChange={scheme.setSettings}
            onVision={setVision}
            settings={settings}
            vision={vision}
          />
        </div>
        <HueMap
          handles={colors.map((hex, i) => ({
            // The anchor always turns. Another colour moves when single
            // colours are on and it isn't locked.
            fixed: i !== anchorAt && (!scheme.individual || Boolean(locked[i])),
            held: scheme.held(i) && !arrangement.members[i],
            hex,
            hue: scheme.individual ? arrangement.members[i]?.h : undefined,
            isAnchor: i === anchorAt,
            label:
              arrangement.names[i] || roleLabel(roles[i]) || source[i].name,
            position: order.indexOf(i) + 1,
          }))}
          onHue={(i, h) => {
            scheme.select(i);
            scheme.setColour(i, { h });
          }}
          onRelease={scheme.release}
        />
      </div>
      <SchemeContrast
        colors={displayed}
        labels={order.map(
          (i) =>
            arrangement.names[i] ||
            roleLabel(roles[i]) ||
            source[i].name ||
            nameOf(i)
        )}
        slots={order}
      />
      <div className="studio__actions">
        {kits.length > 1 ? (
          <KitPicker kits={kits} onChange={setTargetId} value={target?.id} />
        ) : null}
        {target ? (
          <button
            className="studio__button studio__button--primary"
            disabled={saving}
            onClick={() => void save()}
            title="Saves a new version of that kit; its old palette stays in its history"
            type="button"
          >
            <Save size={14} /> Save to {target.name}
          </button>
        ) : null}
        {target && target.resolvedDoc.palette.length > 0 ? (
          <button
            className="studio__button"
            onClick={() =>
              scheme.loadBrand(target.resolvedDoc.palette, target.id)
            }
            title="Loads that kit's colours, with their names, to edit or save into another kit"
            type="button"
          >
            <FolderOpen size={14} />{" "}
            {target.id === kit?.id
              ? "Load brand colours"
              : `Load ${target.name} colours`}
          </button>
        ) : null}
        <button
          className="studio__button"
          onClick={scheme.startOver}
          title="A new palette from the defaults"
          type="button"
        >
          <RotateCcw size={14} /> Start over
        </button>
        <button
          className="studio__button"
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to board
        </button>
        <button
          className="studio__button"
          onClick={() => copy(displayed.join(", "), "Hex values")}
          type="button"
        >
          <Copy size={14} /> Hex
        </button>
        <button
          className="studio__button"
          onClick={() =>
            copy(displayed.map(oklchOf).join("\n"), "OKLCH values")
          }
          type="button"
        >
          <Copy size={14} /> OKLCH
        </button>
        <button
          className="studio__button"
          onClick={() =>
            copy(
              cssOf(
                displayed,
                order.map((i) => roles[i])
              ),
              "CSS"
            )
          }
          type="button"
        >
          <Copy size={14} /> CSS
        </button>
        <button
          className="studio__button"
          onClick={() =>
            saveBlob(
              new Blob([swatchesSvg([{ colors: displayed }]).svg], {
                type: "image/svg+xml",
              }),
              "palette.svg"
            )
          }
          type="button"
        >
          <Download size={14} /> SVG
        </button>
        {locked.some(Boolean) ? (
          <button
            className="studio__button"
            onClick={scheme.unlockAll}
            type="button"
          >
            Unlock all
          </button>
        ) : null}
      </div>
    </div>
  );
}
