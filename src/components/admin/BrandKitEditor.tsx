import { HugeiconsIcon } from "@hugeicons/react";
import PaintBoardIcon from "@hugeicons-pro/core-stroke-standard/PaintBoardIcon";
import { type ReactNode, useEffect, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  inheritedParts,
  kitPromptText,
  MAX_KIT_NAME,
  MAX_VOICE,
  resolveKitDoc,
  sanitizeKitDoc,
} from "../../../config/brandKit.js";
import { useProofBoard } from "../../boards/brand/useProofBoard";
import type { BrandKit } from "../../services/brandKitService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BrandKitComponents } from "./BrandKitComponents";
import {
  CssImport,
  LogoEditor,
  LookPicker,
  PaletteEditor,
} from "./BrandKitFields";
import { LibraryPicker } from "./BrandKitLibrary";
import { FormatPreviews, PalettePreview } from "./BrandKitPreviews";
import { BrandSources } from "./BrandKitWebsites";
import { useConfirm } from "./ConfirmProvider";
import { EditorBlock, useCollapsedBlocks } from "./EditorBlock";
import { EditorShell, PanelGroup } from "./EditorShell";
import { type KitSaveState, useKitAutosave } from "./useKitAutosave";
import "../../styles/primitives.css";
import "../../styles/adminChrome.css";
import { TypefaceEditor } from "./BrandFontsEditor";
import "./BrandKitsPanel.css";

/**
 * One brand kit, being edited.
 *
 * One screen, because a kit is only judgeable whole. The palette without the
 * voice is a swatch grid, and the voice without the palette is a paragraph
 * nobody can check anything against — which is the failure `config/brandKit.ts`
 * describes when it says a kit is a governing document rather than a moodboard.
 * Its limits were chosen so that every part can be shown at once; this is the
 * screen that was assumed.
 *
 * It saves itself a moment after each change, and on the way out; there is
 * no Save button (useKitAutosave). Once, every save wrote a version, so
 * saving per keystroke would have made the history useless — the server now
 * folds the editor's saves into the kit's working version while nothing has
 * been made against it (writeKitEdit), and starts a new one after that.
 *
 * Before this, local-until-Save lost a kit: a whole brand built up, a click
 * on "Back to kits", and a card still reading "0 colours". Saving on its own
 * closes that, and the browser still asks on unload while a save is pending.
 */

const SAVE_LABELS: Record<KitSaveState, string> = {
  failed: "Not saved",
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Saving soon",
};

/** The editor's blocks, for Collapse all. */
const BLOCK_IDS = [
  "components",
  "preview",
  "palette",
  "css",
  "logos",
  "typefaces",
  "look",
  "voice",
  "library",
  "sources",
];

export function KitEditor({
  kit,
  onClose,
  onSaved,
  parentDoc,
}: {
  kit: BrandKit;
  onClose: () => void;
  onSaved: () => void;
  /** The parent's resolved document, when this kit is a sub-brand. */
  parentDoc: BrandKitDoc | null;
}) {
  const { confirm } = useConfirm();
  const { proofHandlerFor } = useProofBoard();
  const [doc, setDoc] = useState<BrandKitDoc>(kit.doc);
  const [name, setName] = useState(kit.name);
  const { flush, state } = useKitAutosave({ doc, kit, name, onSaved });
  const pending = state !== "saved";

  /*
   * The browser's own guard, for the exits this component cannot see: a
   * reload or a closed tab while a save is still pending or has failed.
   */
  useEffect(() => {
    if (!pending) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigning returnValue is what actually triggers the prompt in Safari
      // and older Chrome; preventDefault alone is the modern spelling and both
      // are needed for it to fire everywhere.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  /** Leaving: the last change saved first, and asked about only if it failed. */
  const close = async () => {
    if (
      !(
        (await flush()) ||
        (await confirm({
          cancelLabel: "Keep editing",
          confirmLabel: "Leave anyway",
          description:
            "The last changes to this kit could not be saved. Leaving now throws them away.",
          destructive: true,
          title: "Changes not saved",
        }))
      )
    ) {
      return;
    }
    onClose();
  };

  /* What the kit means as edited: the parent's parts still showing through
     wherever this one leaves a gap. `resolvedDoc` from the server covers the
     saved state; this recomputes it live against the same rule. */
  const own = sanitizeKitDoc(doc);
  const inheritedFrom = kit.parentId ? parentDoc : null;
  const effective = resolveKitDoc(own, inheritedFrom);
  /* Recomputed from what is on screen, not read off the saved kit: overriding a
     part should stop the panel claiming to inherit it before the save, or the
     line contradicts the fields under it. */
  const inheriting = inheritedParts(own, inheritedFrom);
  const prompt = kitPromptText(effective);
  const collapse = useCollapsedBlocks(`brand-kit-folded:${kit.id}`);
  const allFolded = BLOCK_IDS.every((id) => collapse.isCollapsed(id));

  const block = (id: string, title: string, children: ReactNode) => (
    <EditorBlock
      collapsed={collapse.isCollapsed(id)}
      onToggle={() => collapse.toggle(id)}
      title={title}
    >
      {children}
    </EditorBlock>
  );

  return (
    <EditorShell
      backLabel="Brand kits"
      label="Brand kit settings"
      onBack={() => void close()}
      panel={
        <>
          <h2 className="editor-shell__title">
            <HugeiconsIcon aria-hidden icon={PaintBoardIcon} size={16} />
            {name.trim() || kit.name}
          </h2>

          <PanelGroup title="Version">
            {/* Said, not implied: whether what is on screen is saved yet. */}
            <p className="brand-kit__version">
              {kit.version === null
                ? "No version yet"
                : `v${kit.version} of ${kit.versionCount}`}
              <span
                className="brand-kit__unsaved"
                data-state={state}
                role="status"
              >
                {" · "}
                {SAVE_LABELS[state]}
              </span>
            </p>
            {state === "failed" ? (
              <div className="editor-shell__buttons">
                <Button onClick={() => void flush()} type="button">
                  Try saving again
                </Button>
              </div>
            ) : null}
          </PanelGroup>

          <PanelGroup title="Settings">
            <div className="editor-shell__field">
              <label className="admin-caps" htmlFor="brand-kit-name">
                Name
              </label>
              <Input
                id="brand-kit-name"
                maxLength={MAX_KIT_NAME}
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </div>
            {/*
              A sub-brand's empty parts are not empty in effect — they are the
              parent's. Said out loud, because a palette that looks unset but
              paints the previews is the most confusing state this can be in.
            */}
            {kit.parentName ? (
              <p className="brand-kit__inherits">
                A sub-brand of <strong>{kit.parentName}</strong>
                {inheriting.length > 0
                  ? ` — taking its ${inheriting.join(", ")}. Fill a part in here to override it.`
                  : " — overriding every part."}
              </p>
            ) : null}
          </PanelGroup>

          {/* What the kit contributes to a generation (see kitPromptText). */}
          <PanelGroup title="What this sends to a model">
            <p className="brand-kit__prompt">
              {prompt || "Nothing yet — add a colour or a line of voice."}
            </p>
          </PanelGroup>
        </>
      }
      storageKey="brand-kit-panel-open"
    >
      <div className="brand-kit stack stack--mid">
        <div className="row row--end">
          <Button
            onClick={() => collapse.setAll(BLOCK_IDS, !allFolded)}
            type="button"
            variant="ghost"
          >
            {allFolded ? "Expand all" : "Collapse all"}
          </Button>
        </div>

        {/*
          Previewed from the *resolved* document, not this kit's own: a
          sub-brand that states nothing still produces its parent's brand.
          The blocks below edit what this kit states; this is the outcome.
        */}
        {block(
          "preview",
          "Preview",
          <div className="stack stack--mid">
            <section className="stack stack--snug">
              <h3 className="admin-caps">Colours</h3>
              <PalettePreview doc={effective} />
            </section>
            <section className="stack stack--snug">
              <h3 className="admin-caps">In the formats it will be used in</h3>
              <FormatPreviews doc={effective} name={name || "Your brand"} />
            </section>
          </div>
        )}
        {block(
          "palette",
          "Palette",
          <PaletteEditor doc={doc} onChange={setDoc} />
        )}
        {block(
          "css",
          "Colours from CSS",
          <CssImport doc={doc} onChange={setDoc} />
        )}
        {block(
          "logos",
          "Logos",
          <LogoEditor
            doc={doc}
            onChange={setDoc}
            onProof={proofHandlerFor(kit)}
          />
        )}
        {block(
          "typefaces",
          "Typefaces",
          <TypefaceEditor doc={doc} onChange={setDoc} />
        )}
        {block("look", "Look", <LookPicker doc={doc} onChange={setDoc} />)}
        {block(
          "components",
          "Components",
          <BrandKitComponents
            doc={doc}
            effective={effective}
            onChange={setDoc}
          />
        )}
        {block(
          "voice",
          "Voice",
          <div className="stack stack--snug">
            <textarea
              aria-label="Voice"
              className="admin-control brand-kit__voice"
              maxLength={MAX_VOICE}
              onChange={(e) => setDoc({ ...doc, voice: e.target.value })}
              placeholder="Plain, unfussy, never salesy. Short sentences."
              value={doc.voice}
            />
            <p className="brand-kit__count">
              {doc.voice.length} / {MAX_VOICE}
            </p>
          </div>
        )}
        {block(
          "library",
          "Image library",
          <LibraryPicker doc={doc} onChange={setDoc} />
        )}
        {block(
          "sources",
          "Websites and sources",
          <BrandSources
            doc={doc}
            effective={effective}
            kitName={name.trim() || kit.name}
            onChange={setDoc}
          />
        )}
      </div>
    </EditorShell>
  );
}
