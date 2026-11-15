import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import Edit02Icon from "@hugeicons-pro/core-stroke-standard/Edit02Icon";
import Invoice03Icon from "@hugeicons-pro/core-stroke-standard/Invoice03Icon";
import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  type ProposalRecord,
  type ProposalSummary,
  proposalsApi,
} from "../../services/proposalService";
import { Button } from "../ui/button";
import { CardContent, CardFooter, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { AdminCard } from "./AdminFrame";
import {
  AdminEmpty,
  AdminList,
  AdminListPage,
  AdminListRow,
  AdminMono,
  AdminRowAction,
  AdminRowLink,
  AdminStatus,
} from "./AdminList";
import { useConfirm } from "./ConfirmProvider";
import { ProposalEditor } from "./ProposalEditor";

const labelClass = "text-sm uppercase tracking-widest text-white/90";

/** Mirrors the API's slug rules so the suggested address is accepted as is. */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const listStatus = (proposal: ProposalSummary): string => {
  if (proposal.acceptance) {
    return "accepted";
  }
  return proposal.sent ? "sent" : proposal.status;
};

/** The status, coloured by how far along it is: draft, published, sent, accepted. */
const statusTone = (
  proposal: ProposalSummary
): "done" | "draft" | "pending" | "ready" => {
  if (proposal.acceptance) {
    return "done";
  }
  if (proposal.sent) {
    return "pending";
  }
  return proposal.status === "published" ? "ready" : "draft";
};

/**
 * The proposals list, and the editor for whichever one the address names.
 *
 * Same shape as PagesPanel: the URL decides what is open, so a proposal being
 * edited is a link you can come back to, and Back returns to the list.
 */
export function ProposalsPanel() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const { slug: editingSlug } = useParams<{ slug: string }>();
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [editing, setEditing] = useState<ProposalRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setProposals(await proposalsApi.list());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load proposals"
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openProposal = (slug: string): void => {
    navigate(`/admin/proposals/${encodeURIComponent(slug)}`);
  };

  const closeEditor = (): void => {
    navigate("/admin/proposals");
  };

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    setIsBusy(true);
    try {
      const created = await proposalsApi.create({
        clientName: newClient.trim(),
        slug: slugify(title),
        status: "draft",
        title,
      });
      toast.success(`"${created.title}" created as a draft`);
      setNewTitle("");
      setNewClient("");
      setIsCreating(false);
      await reload();
      openProposal(created.slug);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create proposal"
      );
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (!editingSlug) {
      setEditing(null);
      return;
    }
    let cancelled = false;
    setEditing(null);
    void (async () => {
      try {
        const record = await proposalsApi.get(editingSlug);
        if (!cancelled) {
          setEditing(record);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not open proposal"
          );
          navigate("/admin/proposals", { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingSlug, navigate]);

  const handleDelete = async (proposal: ProposalSummary): Promise<void> => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description:
        "The proposal is removed and its link stops working. This cannot be undone.",
      destructive: true,
      title: `Delete "${proposal.title}"?`,
    });
    if (!ok) {
      return;
    }
    try {
      await proposalsApi.remove(proposal.slug);
      toast.success("Proposal deleted");
      if (editingSlug === proposal.slug) {
        closeEditor();
      }
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete proposal"
      );
    }
  };

  if (editing) {
    return (
      <ProposalEditor
        onClose={closeEditor}
        onSaved={async (saved) => {
          await reload();
          // A renamed address moves the editor with it, so a reload after
          // saving does not land on a 404.
          if (saved.slug !== editingSlug) {
            navigate(`/admin/proposals/${encodeURIComponent(saved.slug)}`, {
              replace: true,
            });
          }
        }}
        proposal={editing}
      />
    );
  }

  return (
    <AdminListPage
      action={
        <Button
          onClick={() => setIsCreating((v) => !v)}
          type="button"
          variant="ghost"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? "Cancel" : "New proposal"}
        </Button>
      }
      icon={Invoice03Icon}
      title="Proposals"
    >
      {isCreating ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => void handleCreate(e)}
        >
          <AdminCard>
            <CardHeader>New proposal</CardHeader>
            <CardContent layout="grid">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-proposal-title">
                  Title
                </label>
                <Input
                  autoFocus
                  id="new-proposal-title"
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Pretext launch design"
                  size="lg"
                  value={newTitle}
                />
                {newTitle.trim() ? (
                  <p className="font-mono text-sm text-white/80">
                    /proposal/{slugify(newTitle)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-proposal-client">
                  Client (as it should read on the page)
                </label>
                <Input
                  id="new-proposal-client"
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Vin at Viaskai"
                  size="lg"
                  value={newClient}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                disabled={isBusy || !newTitle.trim()}
                type="submit"
                variant="outline"
              >
                Create draft
              </Button>
            </CardFooter>
          </AdminCard>
        </form>
      ) : null}

      {proposals.length === 0 ? (
        <AdminEmpty>
          No proposals yet. New ones start with the standard sections filled in;
          add the packages and send the link.
        </AdminEmpty>
      ) : (
        <AdminList>
          {proposals.map((proposal) => (
            <AdminListRow
              actions={
                <>
                  <AdminRowLink href={`/proposal/${proposal.slug}`}>
                    View
                  </AdminRowLink>
                  <AdminRowAction
                    icon={Edit02Icon}
                    label={`Edit ${proposal.title}`}
                    onClick={() => openProposal(proposal.slug)}
                  />
                  <AdminRowAction
                    danger
                    icon={Delete02Icon}
                    label={`Delete ${proposal.title}`}
                    onClick={() => void handleDelete(proposal)}
                  />
                </>
              }
              key={proposal.id}
              meta={
                <>
                  {proposal.clientName ? (
                    <span>{proposal.clientName}</span>
                  ) : null}
                  <AdminMono>/proposal/{proposal.slug}</AdminMono>
                </>
              }
              onOpen={() => openProposal(proposal.slug)}
              status={
                <AdminStatus tone={statusTone(proposal)}>
                  {listStatus(proposal)}
                </AdminStatus>
              }
              title={proposal.title}
            />
          ))}
        </AdminList>
      )}
    </AdminListPage>
  );
}
