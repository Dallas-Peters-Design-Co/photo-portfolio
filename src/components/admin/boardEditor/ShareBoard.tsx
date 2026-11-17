import UserGroupIcon from "@hugeicons-pro/core-stroke-standard/UserGroupIcon";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type BoardMember,
  type BoardRole,
  sharingApi,
} from "../../../services/sharingService";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { HeaderIcon } from "./HeaderIcon";
import "./ShareBoard.css";

/**
 * "Share" in the board header: the people this board is shared with, each a
 * Viewer (opens it and comments) or an Editor (also changes it). Adding an
 * address that has never signed in makes them a member; they sign in with
 * Google at /admin (api/_lib/boardAccess.ts). Shown only to the admin: the
 * list is refused to anyone else, and then the button is not drawn.
 */
export function ShareBoard({ boardId }: { boardId: string | null }) {
  const [members, setMembers] = useState<BoardMember[] | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BoardRole>("viewer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!boardId) {
      return;
    }
    sharingApi
      .members(boardId)
      .then(setMembers)
      .catch(() => setAllowed(false));
  }, [boardId]);

  if (!(boardId && allowed)) {
    return null;
  }

  const run = async (work: () => Promise<BoardMember[]>, done: string) => {
    setBusy(true);
    try {
      setMembers(await work());
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update sharing");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (
      await run(
        () => sharingApi.addMember(boardId, address, role),
        `Shared with ${address}`
      )
    ) {
      setEmail("");
    }
  };

  const count = members?.length ?? 0;
  return (
    <>
      <HeaderIcon
        badge={count}
        icon={UserGroupIcon}
        label={count > 0 ? `Shared with ${count}` : "Share with people"}
        onClick={() => setOpen(true)}
        pressed={open}
      />
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this board</DialogTitle>
            <DialogDescription>
              They sign in with Google at {window.location.origin}/admin, using
              the address you add here.
            </DialogDescription>
          </DialogHeader>
          <form className="share-board__form" onSubmit={(e) => void add(e)}>
            <div className="share-board__field">
              <Label htmlFor="share-email">Email</Label>
              <Input
                id="share-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            <fieldset className="share-board__roles">
              <legend className="share-board__legend">Can</legend>
              {(["viewer", "editor"] as const).map((r) => (
                <label className="share-board__role" key={r}>
                  <input
                    checked={role === r}
                    name="share-role"
                    onChange={() => setRole(r)}
                    type="radio"
                  />
                  {r === "viewer" ? "View and comment" : "Edit"}
                </label>
              ))}
            </fieldset>
            <Button disabled={busy} type="submit">
              Share
            </Button>
          </form>
          {members && members.length > 0 ? (
            <ul className="share-board__people">
              {members.map((m) => (
                <li className="share-board__person" key={m.userId}>
                  <span className="share-board__email">{m.email}</span>
                  <select
                    aria-label={`What ${m.email} can do`}
                    className="share-board__select"
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          sharingApi.addMember(
                            boardId,
                            m.email,
                            e.target.value as BoardRole
                          ),
                        `${m.email} updated`
                      )
                    }
                    value={m.role}
                  >
                    <option value="viewer">View and comment</option>
                    <option value="editor">Edit</option>
                  </select>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => sharingApi.removeMember(boardId, m.userId),
                        `${m.email} removed`
                      )
                    }
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="share-board__note">
              Only you can open this board
              {members === null ? "" : " so far"}.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
