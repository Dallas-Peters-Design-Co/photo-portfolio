import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ProposalRecord } from "../../services/proposalService";
import { RecordAcceptance } from "./RecordAcceptance";

/** A yes given by email, recorded as an acceptance of the option chosen. */
const sent: { body: Record<string, unknown>; url: string }[] = [];
vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
  sent.push({ body: JSON.parse(String(init?.body ?? "{}")), url });
  return Promise.resolve(
    Response.json({ acceptance: { option: "audit" }, emailed: {} })
  );
});

const pkg = (id: string, name: string, price: string, recommended = false) => ({
  bestFor: "",
  id,
  includes: [],
  name,
  payment: "",
  price,
  priceNote: "",
  recommended,
  revisions: "",
  timeline: "",
});

const proposal = {
  acceptance: null,
  clientName: "Vin Gokhale",
  doc: {
    packages: [
      pkg("audit", "Audit", "$800"),
      pkg("launch", "Launch", "$3,000", true),
    ],
  },
  slug: "viaskai-pretext-launch",
} as unknown as ProposalRecord;

it("records the chosen option, by whom and how, without emailing anyone", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const recorded = vi.fn(() => Promise.resolve());
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <RecordAcceptance
        busy={false}
        onRecorded={recorded}
        proposal={proposal}
      />
    )
  );
  const select = host.querySelector("select") as HTMLSelectElement;
  // The recommended option first; the client chose the Audit.
  expect(select.value).toBe("launch");
  await act(() => {
    select.value = "audit";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return Promise.resolve();
  });
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Draft agreement and invoice")
  );
  expect(button?.textContent).toContain("Audit");
  await act(async () => button?.click());
  expect(sent[0]?.url).toContain(
    "/api/proposals/viaskai-pretext-launch/accept"
  );
  expect(sent[0]?.body).toEqual({
    name: "Vin Gokhale",
    offline: true,
    option: "audit",
    title: "By email",
  });
  expect(recorded).toHaveBeenCalled();
  root.unmount();
});
