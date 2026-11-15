import { HugeiconsIcon } from "@hugeicons/react";
import PaintBoardIcon from "@hugeicons-pro/core-stroke-standard/PaintBoardIcon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-standard/PlusSignIcon";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { EMPTY_KIT, MAX_KIT_NAME } from "../../../config/brandKit.js";
import { useBrandKits } from "../../hooks/useBrandKits";
import { type BrandKit, brandKitsApi } from "../../services/brandKitService";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { KitCard } from "./BrandKitCard";
import { KitEditor } from "./BrandKitEditor";
import { useConfirm } from "./ConfirmProvider";
import "../../styles/primitives.css";
import "../../styles/adminChrome.css";
import "./BrandKitsPanel.css";

/**
 * The brand kits: the library, and the one being edited (BrandKitEditor).
 */

/**
 * One kit in the library.
 *
 * A brand and a sub-brand use the same card: the only difference is the indent
 * and whether it offers to add a child, which is the parent's business rather
 * than the card's.
 */
export function BrandKitsPanel() {
  const { error, isLoading, kits, refresh } = useBrandKits();
  const { confirm } = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  /** Which brand is having a sub-brand added, if any. */
  const [parentFor, setParentFor] = useState<string | null>(null);
  const [subName, setSubName] = useState("");

  const open = kits.find((kit) => kit.id === openId) ?? null;

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("A kit needs a name");
      return;
    }
    try {
      const kit = await brandKitsApi.create(name, EMPTY_KIT);
      setNewName("");
      await refresh();
      setOpenId(kit.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the kit");
    }
  }, [newName, refresh]);

  const createSub = async (parentId: string) => {
    const name = subName.trim();
    if (!name) {
      toast.error("A sub-brand needs a name");
      return;
    }
    try {
      const kit = await brandKitsApi.create(name, EMPTY_KIT, parentId);
      setSubName("");
      setParentFor(null);
      await refresh();
      setOpenId(kit.id);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not add the sub-brand"
      );
    }
  };

  const remove = async (kit: BrandKit) => {
    const subs = kits.filter((candidate) => candidate.parentId === kit.id);
    const ok = await confirm({
      confirmLabel: "Delete the kit",
      /* The sub-brand count is the part worth stating: they cascade, and a
         sub-brand inherits, so one left behind would be a document with holes
         nothing can fill. */
      description:
        subs.length > 0
          ? `Every version of ${kit.name} goes with it, and so do its ${subs.length} sub-brand${subs.length === 1 ? "" : "s"}. This cannot be undone.`
          : `Every version of ${kit.name} goes with it. This cannot be undone.`,
      destructive: true,
      title: "Delete this brand kit?",
    });
    if (!ok) {
      return;
    }
    try {
      await brandKitsApi.remove(kit.id);
      if (openId === kit.id) {
        setOpenId(null);
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the kit");
    }
  };

  if (open) {
    return (
      <KitEditor
        kit={open}
        onClose={() => setOpenId(null)}
        onSaved={() => void refresh()}
        /* The parent's *resolved* document, which is what a sub-brand inherits
           from — taken from the list rather than fetched, since the list already
           carries every kit's resolution. */
        parentDoc={
          kits.find((candidate) => candidate.id === open.parentId)
            ?.resolvedDoc ?? null
        }
      />
    );
  }

  return (
    <Card className="admin-card">
      <CardHeader className="row row--between row--mid">
        <CardTitle className="admin-heading">
          <HugeiconsIcon icon={PaintBoardIcon} size={16} />
          Brand kits
        </CardTitle>
        <div className="row row--tight">
          <Input
            aria-label="New kit name"
            maxLength={MAX_KIT_NAME}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
            placeholder="New kit…"
            value={newName}
          />
          <Button onClick={() => void create()} type="button">
            <HugeiconsIcon icon={PlusSignIcon} size={14} />
            New kit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="stack stack--mid">
        {error ? (
          <p className="admin-empty">Could not load brand kits.</p>
        ) : null}
        {isLoading ? <p className="admin-empty">Loading…</p> : null}
        {!(isLoading || error) && kits.length === 0 ? (
          <p className="admin-empty">
            No kits yet. A kit is an identity written down so it can be checked
            rather than remembered.
          </p>
        ) : null}
        {/*
          A tree rather than a flat list, because a sub-brand read out of context
          is just a kit with a confusing name. Two levels is all there can be —
          the database enforces it, see patch 032.
         */}
        <ul className="brand-kit__list">
          {kits
            .filter((kit) => !kit.parentId)
            .map((parent) => (
              <li key={parent.id}>
                <KitCard
                  kit={parent}
                  onAddSub={() => setParentFor(parent.id)}
                  onOpen={() => setOpenId(parent.id)}
                  onRemove={() => void remove(parent)}
                />
                {parentFor === parent.id ? (
                  <div className="brand-kit__sub-form row row--tight">
                    <Input
                      aria-label={`Name for a sub-brand of ${parent.name}`}
                      autoFocus
                      maxLength={MAX_KIT_NAME}
                      onChange={(e) => setSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void createSub(parent.id);
                        }
                        if (e.key === "Escape") {
                          setParentFor(null);
                        }
                      }}
                      placeholder={`${parent.name} — …`}
                      value={subName}
                    />
                    <Button
                      onClick={() => void createSub(parent.id)}
                      type="button"
                    >
                      Add
                    </Button>
                  </div>
                ) : null}
                {kits.some((kit) => kit.parentId === parent.id) ? (
                  <ul className="brand-kit__subs">
                    {kits
                      .filter((kit) => kit.parentId === parent.id)
                      .map((sub) => (
                        <li key={sub.id}>
                          <KitCard
                            kit={sub}
                            onOpen={() => setOpenId(sub.id)}
                            onRemove={() => void remove(sub)}
                          />
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
