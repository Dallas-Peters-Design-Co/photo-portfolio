import type { ContractDoc, ContractStatus } from "../../config/contract.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/** Agreements: the client for api/contracts. */

export interface ContractSignature {
  at: string;
  name: string;
  title: string | null;
}

export interface ContractRecord {
  clientEmail: string | null;
  clientName: string;
  clientSignature: ContractSignature | null;
  createdAt: string;
  doc: ContractDoc;
  id: string;
  ownerSignature: ContractSignature | null;
  proposalSlug: string | null;
  sentAt: string | null;
  status: ContractStatus;
  title: string;
  updatedAt: string;
}

export interface ContractInput {
  clientEmail?: string | null;
  clientName?: string;
  doc?: ContractDoc;
  title?: string;
}

const path = (id: string): string =>
  `${apiBase()}/api/contracts/${encodeURIComponent(id)}`;

const json = async <T>(res: Response, fallback: string): Promise<T> => {
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  return (await res.json()) as T;
};

const act = async <T = ContractRecord>(
  id: string,
  body: Record<string, unknown>,
  fallback: string
): Promise<T> =>
  json<T>(
    await fetch(path(id), {
      body: JSON.stringify(body),
      headers: jsonHeaders(),
      method: "POST",
    }),
    fallback
  );

export const contractsApi = {
  countersign: (id: string) =>
    act(id, { action: "countersign" }, "Could not countersign"),

  /** The proposal's agreement, drafted from it if there isn't one yet. */
  create: (proposalSlug: string) =>
    act(
      "new",
      { action: "create", proposal: proposalSlug },
      "Could not draft the agreement"
    ),

  /** The proposal's agreement, or null when none has been drafted. */
  forProposal: async (proposalSlug: string): Promise<ContractRecord | null> =>
    json(
      await fetch(
        `${path("for")}?proposal=${encodeURIComponent(proposalSlug)}`,
        { headers: jsonHeaders() }
      ),
      "Could not load the agreement"
    ),

  get: async (id: string): Promise<ContractRecord> =>
    json(
      await fetch(path(id), { headers: jsonHeaders() }),
      "Agreement not found"
    ),

  remove: async (id: string): Promise<void> => {
    const res = await fetch(path(id), {
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (!(res.ok || res.status === 404)) {
      throw new Error(await readPageError(res, "Could not delete"));
    }
  },

  reopen: (id: string) => act(id, { action: "reopen" }, "Could not reopen"),

  send: (id: string, note = "") =>
    act<ContractRecord & { emailed: boolean }>(
      id,
      { action: "send", note },
      "Could not send the agreement"
    ),

  sign: (id: string, input: { agree: boolean; name: string; title: string }) =>
    act(id, { action: "sign", ...input }, "Could not sign"),

  update: (id: string, input: ContractInput) =>
    act(id, { action: "update", ...input }, "Could not save the agreement"),
};

export const contractPdfFilename = (contract: ContractRecord): string =>
  `agreement-${(contract.proposalSlug ?? contract.id.slice(0, 8)).replace(/[^a-z0-9-]/gi, "")}.pdf`;
