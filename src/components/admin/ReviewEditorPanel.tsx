import { HugeiconsIcon } from "@hugeicons/react";
import SearchVisualIcon from "@hugeicons-pro/core-stroke-standard/SearchVisualIcon";
import { ExternalLink, KeyRound, RotateCcw, ScanSearch } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useBrandKits } from "../../hooks/useBrandKits";
import type { ReviewRecord } from "../../services/reviewService";
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
import { PanelGroup } from "./EditorShell";

/**
 * What the review editor's side panel holds (EditorShell): saving and
 * publishing, the review's settings, the audit, client access and sending.
 */
export function ReviewEditorPanel({
  actions,
  audit,
  clientAccess,
  draft,
  send,
  setDraft,
}: {
  /** Save, Publish, Preview, PDF, the board. */
  actions: ReactNode;
  audit: {
    label: string;
    loginLabel: string;
    onAudit: () => void;
    onLoginAudit: () => void;
    /** Runs the audit again, replacing its last results; absent before one. */
    onRedo?: () => void;
    running: boolean;
  };
  clientAccess: ReactNode;
  draft: ReviewRecord;
  send: ReactNode;
  setDraft: (update: (d: ReviewRecord) => ReviewRecord) => void;
}) {
  const { kits } = useBrandKits();
  const navigate = useNavigate();
  const selectedKit = kits.find((kit) => kit.id === draft.brandKitId);
  // "" is the "no kit" choice.
  const kitItems = [
    { label: "None (site accent)", value: "" },
    ...kits.map((kit) => ({
      label: kit.parentName ? `${kit.parentName} / ${kit.name}` : kit.name,
      value: kit.id,
    })),
  ];

  return (
    <>
      <h2 className="editor-shell__title">
        <HugeiconsIcon aria-hidden icon={SearchVisualIcon} size={16} />
        {draft.title || "Untitled review"}
      </h2>

      <PanelGroup title="Save and share">{actions}</PanelGroup>

      <PanelGroup title="Settings">
        <div className="editor-shell__field">
          <Label htmlFor="review-title">Title</Label>
          <Input
            id="review-title"
            onChange={(e) => {
              const { value } = e.target;
              setDraft((d) => ({ ...d, title: value }));
            }}
            size="lg"
            value={draft.title}
          />
        </div>
        <div className="editor-shell__field">
          <Label htmlFor="review-client">Client label</Label>
          <Input
            id="review-client"
            onChange={(e) => {
              const { value } = e.target;
              setDraft((d) => ({ ...d, clientName: value }));
            }}
            placeholder="Vin at Viaskai"
            size="lg"
            value={draft.clientName}
          />
        </div>
        <div className="editor-shell__field">
          <Label htmlFor="review-email">Client email</Label>
          <Input
            id="review-email"
            onChange={(e) => {
              const value = e.target.value || null;
              setDraft((d) => ({ ...d, clientEmail: value }));
            }}
            placeholder="Gets the link"
            size="lg"
            type="email"
            value={draft.clientEmail ?? ""}
          />
        </div>
        <div className="editor-shell__field">
          <Label htmlFor="review-kit">Brand kit</Label>
          <Select
            items={kitItems}
            onValueChange={(value) => {
              if (value !== null) {
                setDraft((d) => ({ ...d, brandKitId: value || null }));
              }
            }}
            value={draft.brandKitId ?? ""}
          >
            <SelectTrigger id="review-kit" size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kitItems.map((kit) => (
                <SelectItem key={kit.value} value={kit.value}>
                  {kit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedKit ? (
            <Button
              onClick={() =>
                navigate(
                  `/admin/brand-kits?open=${encodeURIComponent(selectedKit.id)}`
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <ExternalLink aria-hidden size={14} />
              Open {selectedKit.name}
            </Button>
          ) : null}
        </div>
        <div className="editor-shell__field">
          <Label htmlFor="review-slug">Address</Label>
          <Input
            face="mono"
            id="review-slug"
            onChange={(e) => {
              const { value } = e.target;
              setDraft((d) => ({ ...d, slug: value }));
            }}
            size="lg"
            value={draft.slug}
          />
          <p className="font-mono text-micro-xs text-white/60">
            /review/{draft.slug}
          </p>
        </div>
      </PanelGroup>

      <PanelGroup title="Audit">
        <div className="editor-shell__buttons">
          <Button
            disabled={audit.running}
            onClick={audit.onAudit}
            title="Audit the screens with pictures, or capture a page first, and add findings, sections and pins"
            type="button"
            variant="outline"
          >
            <ScanSearch size={14} />
            {audit.label}
          </Button>
          {audit.onRedo ? (
            <Button
              disabled={audit.running}
              onClick={audit.onRedo}
              title="Run the audit again on the same screens: its findings, sections, pins and summary are replaced; your own notes stay"
              type="button"
              variant="outline"
            >
              <RotateCcw size={14} />
              Redo audit
            </Button>
          ) : null}
          <Button
            disabled={audit.running}
            onClick={audit.onLoginAudit}
            title="The audit agent signs in with the stored test account, captures the key pages, then runs the UX audit"
            type="button"
            variant="outline"
          >
            <KeyRound size={14} />
            {audit.loginLabel}
          </Button>
        </div>
      </PanelGroup>

      <PanelGroup title="Client access">{clientAccess}</PanelGroup>

      <PanelGroup title="Send to client">{send}</PanelGroup>
    </>
  );
}
