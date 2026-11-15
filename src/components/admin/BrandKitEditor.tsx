import { HugeiconsIcon } from "@hugeicons/react";
import PaintBoardIcon from "@hugeicons-pro/core-stroke-standard/PaintBoardIcon";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { type BrandKit, brandKitsApi } from "../../services/brandKitService";
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
 * Editing is local until Save. Every save writes a *version*, so autosaving a
 * keystroke would mint a version per character and make the history useless for
 * the one question it exists to answer.
 *
 * That rule is right, and on its own it lost a kit. Local-until-Save means the
 * editor holds the only copy of everything typed into it, and leaving discarded
 * that copy without a word — a whole brand built up, a click on "Back to kits",
 * and a card still reading "0 colours". So every way out of a dirty editor is
 * now guarded: the button asks, and the browser asks on unload. The dirty state
 * is also said out loud rather than left implied by an enabled button, because
 * "there is unsaved work here" is exactly what nobody could see.
 */

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
  const [isSaving, setIsSaving] = useState(false);

  // A different kit in the same slot is a different document.
  useEffect(() => {
    setDoc(kit.doc);
    setName(kit.name);
  }, [kit.doc, kit.name]);

  const isDirty =
    JSON.stringify(sanitizeKitDoc(doc)) !== JSON.stringify(kit.doc) ||
    name.trim() !== kit.name;

  /*
   * The browser's own guard, for the exits this component cannot see.
   *
   * Closing the tab, reloading, and following one of the admin's nav links all
   * unmount the editor without going through its own button. The router here is
   * a plain <Routes> with no navigation blocker to hook, so this is the only
   * thing that covers a reload or a close — and it is the case that matters
   * most, because there is nothing to come back to.
   */
  useEffect(() => {
    if (!isDirty) {
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
  }, [isDirty]);

  /** Leaving, having asked first if there is anything to lose. */
  const close = async () => {
    if (
      isDirty &&
      !(await confirm({
        cancelLabel: "Keep editing",
        confirmLabel: "Discard changes",
        description:
          "This kit has edits that have not been saved as a version. Leaving now throws them away.",
        destructive: true,
        title: "Discard unsaved changes?",
      }))
    ) {
      return;
    }
    onClose();
  };

  const save = async () => {
    setIsSaving(true);
    try {
      if (name.trim() && name.trim() !== kit.name) {
        await brandKitsApi.rename(kit.id, name.trim());
      }
      await brandKitsApi.save(kit.id, sanitizeKitDoc(doc));
      toast.success("Kit saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the kit");
    } finally {
      setIsSaving(false);
    }
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

          <PanelGroup title="Save">
            {/* Said, not implied. An enabled Save button was the only sign
                that this screen held the sole copy of the work — see the note
                at the top of the file. */}
            <p className="brand-kit__version">
              {kit.version === null
                ? "No version yet"
                : `v${kit.version} of ${kit.versionCount}`}
              {isDirty ? (
                <span className="brand-kit__unsaved"> · Unsaved changes</span>
              ) : null}
            </p>
            <div className="editor-shell__buttons">
              <Button
                disabled={!isDirty || isSaving}
                onClick={() => void save()}
                type="button"
              >
                {isSaving ? "Saving…" : "Save a new version"}
              </Button>
            </div>
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
