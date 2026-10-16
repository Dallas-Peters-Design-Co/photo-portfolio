import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  Edit02Icon,
  Invoice03Icon,
} from "@hugeicons-pro/core-stroke-standard";
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
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { useConfirm } from "./ConfirmProvider";
import { ProposalEditor } from "./ProposalEditor";

const labelClass = "text-[10px] uppercase tracking-widest text-white/90";
const inputClass =
  "min-h-11 text-base bg-black/40 border-white/10 focus:border-white/40 transition-colors";

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

const statusClass = (status: ProposalSummary["status"]): string =>
  status === "published"
    ? "text-[10px] uppercase tracking-[0.16em] text-emerald-400/70"
    : "text-[10px] uppercase tracking-[0.16em] text-amber-400/70";

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
    <div className="grid w-full max-w-7xl grid-cols-1 gap-4 border-white/10">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-[0.2em]">
          <HugeiconsIcon icon={Invoice03Icon} size={16} />
          Proposals
        </div>
        <Button
          onClick={() => setIsCreating((v) => !v)}
          type="button"
          variant="ghost"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? "Cancel" : "New proposal"}
        </Button>
      </div>

      {isCreating ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => void handleCreate(e)}
        >
          <Card className="w-full border-white bg-white/2">
            <CardHeader className={labelClass}>New proposal</CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-proposal-title">
                  Title
                </label>
                <Input
                  autoFocus
                  className={inputClass}
                  id="new-proposal-title"
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Pretext launch design"
                  value={newTitle}
                />
                {newTitle.trim() ? (
                  <p className="font-mono text-[10px] text-white/80">
                    /proposal/{slugify(newTitle)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-proposal-client">
                  Client (as it should read on the page)
                </label>
                <Input
                  className={inputClass}
                  id="new-proposal-client"
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Vin at Viaskai"
                  value={newClient}
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-3">
              <Button
                disabled={isBusy || !newTitle.trim()}
                type="submit"
                variant="outline"
              >
                Create draft
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}

      {proposals.length === 0 ? (
        <p className="text-[11px] text-white/80 uppercase tracking-[0.15em]">
          No proposals yet. New ones start with the standard sections filled in;
          add the packages and send the link.
        </p>
      ) : (
        <ul className="grid grid-cols-1 divide-y divide-white/6">
          {proposals.map((proposal) => (
            <Card className="border-white bg-white/2" key={proposal.id}>
              <CardContent>
                <li className="flex items-center gap-3 py-3">
                  <button
                    className="flex-1 text-left"
                    onClick={() => openProposal(proposal.slug)}
                    type="button"
                  >
                    <span className="text-sm text-white/85">
                      {proposal.title}
                    </span>
                    {proposal.clientName ? (
                      <span className="ml-2 text-white/60 text-xs">
                        {proposal.clientName}
                      </span>
                    ) : null}
                    <span className="ml-2 font-mono text-[10px] text-white/80">
                      /proposal/{proposal.slug}
                    </span>
                  </button>
                  <span className={statusClass(proposal.status)}>
                    {listStatus(proposal)}
                  </span>
                  <a
                    className="text-[10px] text-white/90 uppercase tracking-[0.16em] transition-colors hover:text-white"
                    href={`/proposal/${proposal.slug}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View
                  </a>
                  <button
                    aria-label={`Edit ${proposal.title}`}
                    className="text-white/80 transition-colors hover:text-blue-400"
                    onClick={() => openProposal(proposal.slug)}
                    type="button"
                  >
                    <HugeiconsIcon icon={Edit02Icon} size={14} />
                  </button>
                  <button
                    aria-label={`Delete ${proposal.title}`}
                    className="text-white/80 transition-colors hover:text-red-400"
                    onClick={() => void handleDelete(proposal)}
                    type="button"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                  </button>
                </li>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
