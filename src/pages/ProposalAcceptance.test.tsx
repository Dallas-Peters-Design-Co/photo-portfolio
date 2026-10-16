// The real stylesheet: the PDF is the print stylesheet, so the assertions
// about it have to read the rules the browser actually parsed.
import "./ProposalPage.css";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalRecord } from "../services/proposalService";

/**
 * The signature block and the PDF, from the client's chair.
 *
 * Two things here are business critical and neither is covered by the API
 * tests: that the inputs on the signature line drive the Accept button and
 * reach the API as typed, and that "Download PDF" is the browser's print with
 * a stylesheet that turns the sheet into the page. A button wired to the
 * wrong handler, or a print rule that stopped hiding the masthead, would look
 * fine in the editor and wrong in the client's inbox.
 */

const accept =
  vi.fn<
    (
      slug: string,
      input: { name: string; title?: string; option?: string }
    ) => Promise<
      ProposalRecord & { emailed: { client: boolean; owner: boolean } }
    >
  >();

vi.mock("../services/proposalService", () => ({
  proposalsApi: { accept },
}));

const { ProposalAcceptance, formatDate } = await import("./ProposalAcceptance");

const PROPOSAL: ProposalRecord = {
  acceptance: null,
  brand: { accent: null, name: "Viaskai" },
  brandKitId: null,
  clientEmail: "vin@viask.ai",
  clientName: "Vin at Viaskai",
  createdAt: "2026-10-16T00:00:00.000Z",
  doc: {
    addOns: [],
    closing: "",
    intro: "",
    packages: [
      {
        bestFor: "",
        id: "pkg-audit",
        includes: [],
        name: "Audit",
        payment: "",
        price: "$2,500",
        priceNote: "",
        recommended: false,
        revisions: "",
        timeline: "",
      },
      {
        bestFor: "",
        id: "pkg-launch",
        includes: [],
        name: "Launch Package",
        payment: "",
        price: "$9,500",
        priceNote: "",
        recommended: true,
        revisions: "",
        timeline: "",
      },
    ],
    process: [],
    sections: [],
    summary: "",
    terms: [],
    validUntil: "",
  },
  id: "p1",
  sent: null,
  slug: "viaskai-pretext-launch",
  status: "published",
  title: "Pretext launch",
  updatedAt: "2026-10-16T00:00:00.000Z",
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const render = async (ui: ReactElement): Promise<HTMLDivElement> => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(ui);
  await flush();
  return host;
};

/** Types into a React-controlled input the way a person would. */
const type = (field: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

/**
 * Mounts the block the way the page does: the page owns the proposal and
 * swaps in the record `onAccepted` hands back, which is what flips the block
 * from form to signatures.
 */
const mount = (over: Partial<ProposalRecord> = {}) => {
  const tree = (proposal: ProposalRecord) => (
    <ProposalAcceptance
      issued="16 October 2026"
      onAccepted={onAccepted}
      ownerName="Dallas Peters"
      proposal={proposal}
    />
  );
  const onAccepted = vi.fn((next: ProposalRecord) => {
    root?.render(tree(next));
  });
  const ui = render(tree({ ...PROPOSAL, ...over }));
  return { onAccepted, ui };
};

const q = <T extends Element>(el: ParentNode, sel: string): T => {
  const found = el.querySelector<T>(sel);
  if (!found) {
    throw new Error(`Missing ${sel}`);
  }
  return found;
};

const button = (el: ParentNode, text: string): HTMLButtonElement => {
  const found = [...el.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text)
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found;
};

beforeEach(() => {
  accept.mockReset();
});

afterEach(() => {
  root?.unmount();
  host?.remove();
  host = null;
  root = null;
  vi.restoreAllMocks();
});

describe("Download PDF", () => {
  it("is the browser's print, before and after signing", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    const { ui } = mount();
    const before = button(await ui, "Download PDF");
    expect(before.type).toBe("button");
    before.click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(accept).not.toHaveBeenCalled();
    root?.unmount();
    host?.remove();

    const signed = mount({
      acceptance: {
        at: "2026-10-16T20:00:00.000Z",
        name: "Vin Patel",
        option: "pkg-launch",
        title: "Founder",
      },
    });
    button(await signed.ui, "Download PDF").click();
    expect(print).toHaveBeenCalledTimes(2);
  });

  it("prints the sheet as the page: chrome hidden, clauses kept whole", () => {
    const rules: CSSStyleRule[] = [];
    let page: CSSPageRule | null = null;
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSPageRule) {
          page = rule;
        }
        if (rule instanceof CSSMediaRule && rule.media.mediaText === "print") {
          for (const inner of rule.cssRules) {
            if (inner instanceof CSSStyleRule) {
              rules.push(inner);
            }
          }
        }
      }
    }
    expect(
      rules.length,
      "a @media print block from ProposalPage.css"
    ).toBeGreaterThan(0);

    const hidden = rules
      .filter((r) => r.style.display === "none")
      .flatMap((r) => r.selectorText.split(",").map((s) => s.trim()));
    for (const chrome of [
      ".proposal-page__masthead",
      ".proposal-page__footer",
      ".proposal-page__actions",
      ".proposal-page__draft",
    ]) {
      expect(hidden, `${chrome} hidden in print`).toContain(chrome);
    }
    // The signature block and the clauses are what the PDF is for.
    expect(hidden).not.toContain(".proposal-page__signatures");
    expect(hidden).not.toContain(".proposal-page__clause");

    const unbroken = rules.find((r) =>
      r.selectorText.includes(".proposal-page__clause")
    );
    expect(unbroken?.style.getPropertyValue("break-inside")).toBe("avoid");

    expect(page, "an @page rule for the margins").not.toBeNull();
    expect(page?.style.margin).toContain("mm");
  });
});

describe("the signature line", () => {
  it("enables Accept only once a name is typed", async () => {
    const { ui } = mount();
    const el = await ui;
    const acceptButton = button(el, "Accept and sign");
    expect(acceptButton.disabled).toBe(true);

    type(q(el, 'input[aria-label="Your name"]'), "   ");
    await flush();
    expect(acceptButton.disabled).toBe(true);

    type(q(el, 'input[aria-label="Your name"]'), "Vin Patel");
    await flush();
    expect(acceptButton.disabled).toBe(false);
  });

  it("leads with the recommended option", async () => {
    const { ui } = mount();
    const checked = q<HTMLInputElement>(
      await ui,
      'input[name="option"]:checked'
    );
    expect(checked.value).toBe("pkg-launch");
  });

  it("sends name, title and the chosen option, then shows the copy is on its way", async () => {
    accept.mockResolvedValue({
      ...PROPOSAL,
      acceptance: {
        at: "2026-10-16T20:00:00.000Z",
        name: "Vin Patel",
        option: "pkg-audit",
        title: "Founder",
      },
      emailed: { client: true, owner: true },
    });
    const { onAccepted, ui } = mount();
    const el = await ui;

    type(q(el, 'input[aria-label="Your name"]'), "  Vin Patel  ");
    type(q(el, 'input[aria-label="Your title"]'), " Founder ");
    q<HTMLInputElement>(el, 'input[value="pkg-audit"]').click();
    await flush();
    q<HTMLFormElement>(el, "form").requestSubmit();
    await flush();
    await flush();

    expect(accept).toHaveBeenCalledWith("viaskai-pretext-launch", {
      name: "Vin Patel",
      option: "pkg-audit",
      title: "Founder",
    });
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptance: expect.objectContaining({ name: "Vin Patel" }),
      })
    );
    expect(el.textContent).toContain("a copy is on its way to your inbox");
  });

  it("says only Accepted when the client's copy could not be sent", async () => {
    accept.mockResolvedValue({
      ...PROPOSAL,
      acceptance: {
        at: "2026-10-16T20:00:00.000Z",
        name: "Vin Patel",
        option: null,
        title: null,
      },
      emailed: { client: false, owner: true },
    });
    const { ui } = mount();
    const el = await ui;
    type(q(el, 'input[aria-label="Your name"]'), "Vin Patel");
    await flush();
    q<HTMLFormElement>(el, "form").requestSubmit();
    await flush();
    await flush();
    expect(el.textContent).toContain("Accepted");
    expect(el.textContent).not.toContain("on its way");
  });

  it("shows the API's reason when accepting fails, and keeps the form", async () => {
    accept.mockRejectedValue(
      new Error("This proposal has already been accepted.")
    );
    const { onAccepted, ui } = mount();
    const el = await ui;
    type(q(el, 'input[aria-label="Your name"]'), "Vin Patel");
    await flush();
    q<HTMLFormElement>(el, "form").requestSubmit();
    await flush();
    await flush();
    expect(el.textContent).toContain(
      "This proposal has already been accepted."
    );
    expect(el.querySelector("form")).not.toBeNull();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it("does not submit twice while a press is in flight", async () => {
    const gate: { release: (() => void) | null } = { release: null };
    accept.mockImplementation(
      () =>
        new Promise((resolve) => {
          gate.release = () =>
            resolve({
              ...PROPOSAL,
              acceptance: {
                at: "2026-10-16T20:00:00.000Z",
                name: "Vin Patel",
                option: null,
                title: null,
              },
              emailed: { client: true, owner: true },
            });
        })
    );
    const { ui } = mount();
    const el = await ui;
    type(q(el, 'input[aria-label="Your name"]'), "Vin Patel");
    await flush();
    const form = q<HTMLFormElement>(el, "form");
    form.requestSubmit();
    await flush();
    expect(button(el, "Signing").disabled).toBe(true);
    form.requestSubmit();
    await flush();
    expect(accept).toHaveBeenCalledTimes(1);
    gate.release?.();
    await flush();
  });

  it("reads as signed once there is an acceptance on file", async () => {
    const { ui } = mount({
      acceptance: {
        at: "2026-10-16T20:00:00.000Z",
        name: "Vin Patel",
        option: "pkg-launch",
        title: "Founder",
      },
    });
    const el = await ui;
    expect(el.querySelector("form")).toBeNull();
    expect(el.querySelector("input")).toBeNull();
    const text = el.textContent ?? "";
    expect(text).toContain("Vin Patel");
    expect(text).toContain("Founder");
    expect(text).toContain("Launch Package");
    expect(text).toContain("Signed for Viaskai");
    expect(text).toContain("Dallas Peters");
    expect(text).toContain(formatDate("2026-10-16T20:00:00.000Z"));
  });
});

describe("formatDate", () => {
  it("reads a bare date as that day, not the night before", () => {
    expect(formatDate("2026-11-15")).toContain("15");
    expect(formatDate("2026-11-15")).toContain("2026");
  });

  it("hands back what it cannot parse", () => {
    expect(formatDate("soon")).toBe("soon");
  });
});
