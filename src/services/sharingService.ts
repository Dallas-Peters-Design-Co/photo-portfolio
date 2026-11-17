import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/**
 * Sharing boards with people (api/_lib/boardAccess.ts): who is signed in and
 * as what, the people a board is shared with, and the Neon sign-in swap.
 */

export type UserRole = "admin" | "member";
export type BoardRole = "editor" | "viewer";

export interface BoardMember {
  email: string;
  role: BoardRole;
  userId: string;
}

export interface SharedPerson {
  boards: { id: string; role: BoardRole; title: string }[];
  email: string;
  id: string;
}

export interface MemberBoard {
  access: BoardRole;
  coverUrl: string | null;
  id: string;
  title: string;
  updatedAt: string;
}

const membersUrl = (boardId: string, extra = "") =>
  `${apiBase()}/api/boards/${encodeURIComponent(boardId)}?part=members${extra}`;

const membersOf = async (res: Response): Promise<BoardMember[]> => {
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not update sharing"));
  }
  return ((await res.json()) as { members: BoardMember[] }).members;
};

export const sharingApi = {
  /** Shares a board with an address, or changes their level. */
  addMember: async (
    boardId: string,
    email: string,
    role: BoardRole
  ): Promise<BoardMember[]> =>
    membersOf(
      await fetch(membersUrl(boardId), {
        body: JSON.stringify({ email, role }),
        headers: jsonHeaders(),
        method: "POST",
      })
    ),

  /**
   * Exchanges a Neon Auth (Google) sign-in for a session: how someone a board
   * was shared with gets in. Rejects an address nothing was shared with.
   */
  loginWithNeon: async (neonToken: string): Promise<string> => {
    const res = await fetch(`${apiBase()}/api/auth/google`, {
      body: JSON.stringify({ neonToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
    };
    if (!(res.ok && data.token)) {
      throw new Error(data.error || `Sign-in failed (${res.status})`);
    }
    return data.token;
  },

  /** Who the stored session is, and whether they are the admin. */
  me: async (): Promise<{ email: string; id: string; role: UserRole }> => {
    const res = await fetch(`${apiBase()}/api/auth/me`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error("Unauthorized");
    }
    const { user } = (await res.json()) as {
      user: { email: string; id: string; role?: UserRole };
    };
    return { ...user, role: user.role ?? "admin" };
  },

  /** A member's boards: only those shared with them. */
  memberBoards: async (): Promise<MemberBoard[]> => {
    const res = await fetch(`${apiBase()}/api/boards`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load your boards"));
    }
    return (await res.json()) as MemberBoard[];
  },

  members: async (boardId: string): Promise<BoardMember[]> =>
    membersOf(await fetch(membersUrl(boardId), { headers: jsonHeaders() })),

  /** Everyone a board is shared with, and which boards (admin only). */
  people: async (): Promise<SharedPerson[]> => {
    const res = await fetch(`${apiBase()}/api/auth/me?people=1`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load people"));
    }
    return ((await res.json()) as { people: SharedPerson[] }).people;
  },

  removeMember: async (
    boardId: string,
    userId: string
  ): Promise<BoardMember[]> =>
    membersOf(
      await fetch(
        membersUrl(boardId, `&userId=${encodeURIComponent(userId)}`),
        {
          headers: jsonHeaders(),
          method: "DELETE",
        }
      )
    ),
};
