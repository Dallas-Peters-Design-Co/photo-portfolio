import { describe, expect, it } from "vitest";
import {
  firstInstalmentPercent,
  firstInvoiceFor,
  formatMoney,
  priceToCents,
} from "./invoices.js";

/**
 * How a signed option becomes its first invoice. Prices and payment terms
 * are free text in the proposal, so the parsing is the part that can quietly
 * bill the wrong amount.
 */

describe("priceToCents", () => {
  it.each([
    ["$3,000", 300_000],
    ["$3,000 / month", 300_000],
    ["$800", 80_000],
    ["$1,250.50", 125_050],
    ["From $2,500, fixed", 250_000],
  ])("reads %s as %i cents", (price, cents) => {
    expect(priceToCents(price)).toBe(cents);
  });

  it("returns null when there is no figure", () => {
    expect(priceToCents("Let's talk")).toBeNull();
    expect(priceToCents("")).toBeNull();
  });
});

describe("firstInstalmentPercent", () => {
  it.each([
    ["50% to start, 50% at delivery", 50],
    ["100% up front", 100],
    ["30% deposit", 30],
    ["Monthly, in advance", 100],
    ["On delivery", 100],
  ])("reads %s as %i%%", (payment, pct) => {
    expect(firstInstalmentPercent(payment)).toBe(pct);
  });
});

describe("firstInvoiceFor", () => {
  it("bills the deposit for a split payment, and says it is a deposit", () => {
    expect(
      firstInvoiceFor("Pretext launch", {
        name: "Launch",
        payment: "50% to start, 50% at delivery",
        price: "$3,000",
      })
    ).toEqual({
      amountCents: 150_000,
      description: "Pretext launch: Launch, 50% deposit",
    });
  });

  it("bills the whole price when it is due up front or monthly", () => {
    expect(
      firstInvoiceFor("Pretext launch", {
        name: "Audit",
        payment: "100% up front",
        price: "$800",
      })
    ).toEqual({ amountCents: 80_000, description: "Pretext launch: Audit" });
    expect(
      firstInvoiceFor("Pretext launch", {
        name: "After Launch",
        payment: "Monthly, in advance",
        price: "$3,000 / month",
      })?.amountCents
    ).toBe(300_000);
  });

  it("drafts nothing for a price without a figure", () => {
    expect(
      firstInvoiceFor("X", { name: "Custom", payment: "", price: "TBD" })
    ).toBeNull();
  });
});

describe("formatMoney", () => {
  it("drops cents for whole amounts", () => {
    expect(formatMoney(150_000)).toBe("$1,500");
    expect(formatMoney(125_050)).toBe("$1,250.50");
  });
});
