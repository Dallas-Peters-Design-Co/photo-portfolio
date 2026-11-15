import { HugeiconsIcon } from "@hugeicons/react";
import SearchVisualIcon from "@hugeicons-pro/core-stroke-standard/SearchVisualIcon";
import {
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
} from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { BackButton } from "./BackButton";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";
import "./ReviewEditorPanel.css";

const OPEN_KEY = "review-editor-panel-open";

const readOpen = (): boolean => {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
};

/** Whether the side panel is open, remembered across reviews. */
export const usePanelOpen = () => {
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, String(!open));
    } catch {
      // Not remembered in private mode.
    }
  };
  return { open, toggle };
};

function PanelGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="review-editor-panel__group">
      <h3 className="review-editor-panel__group-title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Everything about a review that is not its content, in a panel on the left
 * that folds away: saving and publishing, its settings, the audit, client
 * access and sending. The content — opening, sections, screens, closing —
 * gets the rest of the width.
 */
export function ReviewEditorPanel({
  actions,
  audit,
  clientAccess,
  draft,
  onClose,
  onToggle,
  open,
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
    running: boolean;
  };
  clientAccess: ReactNode;
  draft: ReviewRecord;
  onClose: () => void;
  onToggle: () => void;
  open: boolean;
  send: ReactNode;
  setDraft: (update: (d: ReviewRecord) => ReviewRecord) => void;
}) {
  const { kits } = useBrandKits();
  // "" is the "no kit" choice.
  const kitItems = [
    { label: "None (site accent)", value: "" },
    ...kits.map((kit) => ({
      label: kit.parentName ? `${kit.parentName} / ${kit.name}` : kit.name,
      value: kit.id,
    })),
  ];
  const ToggleIcon = open ? PanelLeftClose : PanelLeftOpen;

  return (
    <aside
      aria-label="Review settings"
      className={`review-editor-panel ${open ? "" : "review-editor-panel--closed"}`}
    >
      <div className="review-editor-panel__bar">
        {open ? <BackButton label="Reviews" onClick={onClose} /> : null}
        <button
          aria-controls="review-editor-panel-body"
          aria-expanded={open}
          aria-label={open ? "Close the panel" : "Open the panel"}
          className="review-editor-panel__toggle"
          onClick={onToggle}
          title={open ? "Close the panel" : "Open the panel"}
          type="button"
        >
          <ToggleIcon aria-hidden size={16} />
        </button>
      </div>

      <div
        className="review-editor-panel__body"
        hidden={!open}
        id="review-editor-panel-body"
      >
        <h2 className="review-editor-panel__title">
          <HugeiconsIcon aria-hidden icon={SearchVisualIcon} size={16} />
          {draft.title || "Untitled review"}
        </h2>

        <PanelGroup title="Save and share">{actions}</PanelGroup>

        <PanelGroup title="Settings">
          <div className="review-editor-panel__field">
            <Label className={proposalLabelClass} htmlFor="review-title">
              Title
            </Label>
            <Input
              className={proposalInputClass}
              id="review-title"
              onChange={(e) => {
                const { value } = e.target;
                setDraft((d) => ({ ...d, title: value }));
              }}
              value={draft.title}
            />
          </div>
          <div className="review-editor-panel__field">
            <Label className={proposalLabelClass} htmlFor="review-client">
              Client label
            </Label>
            <Input
              className={proposalInputClass}
              id="review-client"
              onChange={(e) => {
                const { value } = e.target;
                setDraft((d) => ({ ...d, clientName: value }));
              }}
              placeholder="Vin at Viaskai"
              value={draft.clientName}
            />
          </div>
          <div className="review-editor-panel__field">
            <Label className={proposalLabelClass} htmlFor="review-email">
              Client email
            </Label>
            <Input
              className={proposalInputClass}
              id="review-email"
              onChange={(e) => {
                const value = e.target.value || null;
                setDraft((d) => ({ ...d, clientEmail: value }));
              }}
              placeholder="Gets the link"
              type="email"
              value={draft.clientEmail ?? ""}
            />
          </div>
          <div className="review-editor-panel__field">
            <Label className={proposalLabelClass} htmlFor="review-kit">
              Brand kit
            </Label>
            <Select
              items={kitItems}
              onValueChange={(value) => {
                if (value !== null) {
                  setDraft((d) => ({ ...d, brandKitId: value || null }));
                }
              }}
              value={draft.brandKitId ?? ""}
            >
              <SelectTrigger
                className={`${proposalInputClass} w-full rounded-md border px-3`}
                id="review-kit"
              >
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
          </div>
          <div className="review-editor-panel__field">
            <Label className={proposalLabelClass} htmlFor="review-slug">
              Address
            </Label>
            <Input
              className={`${proposalInputClass} font-mono`}
              id="review-slug"
              onChange={(e) => {
                const { value } = e.target;
                setDraft((d) => ({ ...d, slug: value }));
              }}
              value={draft.slug}
            />
            <p className="font-mono text-micro-xs text-white/60">
              /review/{draft.slug}
            </p>
          </div>
        </PanelGroup>

        <PanelGroup title="Audit">
          <div className="review-editor-panel__buttons">
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
      </div>
    </aside>
  );
}
