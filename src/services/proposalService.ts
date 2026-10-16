import type { ProposalDoc, ProposalStatus } from "../../config/proposal.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/**
 * The proposals, in their own module like brand kits and Lightroom: the shared
 * service file is under a shrink-only rule, and a whole feature's client is
 * exactly what should not be added to it.
 */

export interface ProposalBrand {
  accent: string | null;
  name: string;
}

export interface ProposalAcceptance {
  at: string;
  name: string;
  option: string | null;
  title: string | null;
}

export interface ProposalSent {
  at: string;
  to: string;
}

export interface ProposalSummary {
  acceptance: ProposalAcceptance | null;
  brand: ProposalBrand | null;
  brandKitId: string | null;
  clientEmail: string | null;
  clientName: string;
  createdAt: string;
  id: string;
  sent: ProposalSent | null;
  slug: string;
  status: ProposalStatus;
  title: string;
  updatedAt: string;
}

export type ProposalRecord = ProposalSummary & { doc: ProposalDoc };

export type ProposalInput = Partial<
  Pick<
    ProposalRecord,
    | "title"
    | "slug"
    | "clientName"
    | "clientEmail"
    | "brandKitId"
    | "status"
    | "doc"
  >
> & {
  /** `null` clears a recorded acceptance so the proposal can be re-sent. */
  acceptance?: null;
};

const proposalsPath = (): string => `${apiBase()}/api/proposals`;

export const proposalsApi = {
  /** The client's acceptance: public, once, published proposals only. */
  accept: async (
    slug: string,
    input: { name: string; title?: string; option?: string }
  ): Promise<
    ProposalRecord & { emailed: { client: boolean; owner: boolean } }
  > => {
    const res = await fetch(
      `${proposalsPath()}/${encodeURIComponent(slug)}/accept`,
      {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }
    );
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not accept"));
    }
    return (await res.json()) as ProposalRecord & {
      emailed: { client: boolean; owner: boolean };
    };
  },

  create: async (input: ProposalInput & { title: string; slug: string }) => {
    const res = await fetch(proposalsPath(), {
      body: JSON.stringify(input),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not create proposal"));
    }
    return (await res.json()) as ProposalRecord;
  },

  get: async (slug: string): Promise<ProposalRecord> => {
    const res = await fetch(`${proposalsPath()}/${encodeURIComponent(slug)}`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load proposal"));
    }
    return (await res.json()) as ProposalRecord;
  },

  /** Admin only: every proposal, newest first. */
  list: async (): Promise<ProposalSummary[]> => {
    const res = await fetch(proposalsPath(), { headers: jsonHeaders() });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load proposals"));
    }
    return (await res.json()) as ProposalSummary[];
  },

  remove: async (slug: string): Promise<void> => {
    const res = await fetch(`${proposalsPath()}/${encodeURIComponent(slug)}`, {
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (res.status === 204 || res.status === 404) {
      return;
    }
    throw new Error(await readPageError(res, "Could not delete proposal"));
  },

  /** Admin only: emails the link to the client address on file. */
  send: async (
    slug: string,
    input: { note?: string } = {}
  ): Promise<ProposalRecord> => {
    const res = await fetch(
      `${proposalsPath()}/${encodeURIComponent(slug)}/send`,
      {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }
    );
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not send proposal"));
    }
    return (await res.json()) as ProposalRecord;
  },

  update: async (
    slug: string,
    input: ProposalInput
  ): Promise<ProposalRecord> => {
    const res = await fetch(`${proposalsPath()}/${encodeURIComponent(slug)}`, {
      body: JSON.stringify(input),
      headers: jsonHeaders(),
      method: "PATCH",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not save proposal"));
    }
    return (await res.json()) as ProposalRecord;
  },
};
