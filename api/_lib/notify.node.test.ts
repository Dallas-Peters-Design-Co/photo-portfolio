import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fan-out: record once, then push and (for the kinds that matter) email.
 * A duplicate must tell no one; a failing email or push must not throw.
 */

const sendEmail = vi.fn<(input: { to: string }) => Promise<void>>();
const pushToAll = vi.fn<(sql: unknown, payload: unknown) => Promise<number>>();
class EmailNotConfiguredError extends Error {}

vi.mock("./email.js", () => ({ EmailNotConfiguredError, sendEmail }));
vi.mock("./push.js", () => ({ pushToAll }));
vi.mock("./site.js", () => ({
  emailBrand: () => ({
    domain: "dallaspeters.com",
    key: "dallas-images",
    ownerName: "Dallas Peters",
    tagline: "Product Designer",
  }),
  getSite: () => ({
    defaultAdminEmail: "dallaspeters@gmail.com",
    domain: "dallaspeters.com",
    key: "dallas-images",
    name: "Dallas Peters",
    ownerName: "Dallas Peters",
  }),
}));

const { notify } = await import("./notify.js");

let inserted: { id: string }[] = [];
const sql = vi.fn((..._args: unknown[]) => Promise.resolve(inserted));

beforeEach(() => {
  inserted = [{ id: "a1" }];
  sql.mockClear();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue();
  pushToAll.mockReset();
  pushToAll.mockResolvedValue(1);
});

const viewed = {
  kind: "proposal.viewed" as const,
  subjectId: "p1",
  subjectType: "proposal" as const,
  title: 'Vin opened "Pretext"',
  url: "/admin/proposals/pretext",
};

describe("notify", () => {
  it("records, pushes, and emails the owner for a kind that warrants it", async () => {
    const id = await notify(sql as never, viewed);
    expect(id).toBe("a1");
    expect(pushToAll).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({
        icon: "/sites/dallas-images/icon192.png",
        title: viewed.title,
        url: viewed.url,
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dallaspeters@gmail.com" })
    );
  });

  it("pushes but does not email for routine kinds", async () => {
    await notify(sql as never, { ...viewed, kind: "proposal.delivered" });
    expect(pushToAll).toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("lets the caller override the email default", async () => {
    await notify(sql as never, { ...viewed, email: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("tells no one about a duplicate", async () => {
    inserted = [];
    expect(
      await notify(sql as never, { ...viewed, dedupeKey: "k" })
    ).toBeNull();
    expect(pushToAll).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not throw when the email fails", async () => {
    sendEmail.mockRejectedValue(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(notify(sql as never, viewed)).resolves.toBe("a1");
  });

  it("returns null rather than throwing when the table is missing", async () => {
    sql.mockRejectedValueOnce(new Error('relation "activity" does not exist'));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(notify(sql as never, viewed)).resolves.toBeNull();
    expect(pushToAll).not.toHaveBeenCalled();
  });
});
