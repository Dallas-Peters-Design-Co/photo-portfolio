import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one POST that gets mail out of the door.
 *
 * Resend is reached with fetch, so this stands in a fetch and checks what the
 * request would have carried: the bearer key, the site's own From address,
 * the recipient as the list Resend expects, and both bodies. A proposal's
 * signed copy rides on this, so a wrong From (another site's address) or a
 * swallowed non-2xx would reach a client before anyone here noticed.
 */

vi.mock("./site.js", () => ({
  getSite: () => ({
    defaultAdminEmail: "dallaspeters@gmail.com",
    domain: "dallaspeters.com",
    emailFrom: "Dallas Peters <noreply@dallaspeters.com>",
    key: "dallas-images",
    name: "Dallas Peters",
    origins: [],
    ownerName: "Dallas",
    tagline: "Product Designer",
  }),
}));

const { EmailNotConfiguredError, sendEmail } = await import("./email.js");

const ADDISON = /addisonsphotos/i;
const NOT_VERIFIED = /Resend responded 403: .*Domain is not verified/;

const MAIL = {
  html: "<p>Hi</p>",
  subject: "Your signed copy",
  text: "Hi",
  to: "vin@viask.ai",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_test_123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendEmail", () => {
  it("posts to Resend with the key, the site's From and the recipient", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmail(MAIL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Dallas Peters <noreply@dallaspeters.com>",
      html: "<p>Hi</p>",
      subject: "Your signed copy",
      text: "Hi",
      to: ["vin@viask.ai"],
    });
  });

  it("passes a reply-to when given one, and omits it otherwise", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmail({ ...MAIL, replyTo: "dallaspeters@gmail.com" });
    await sendEmail(MAIL);
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as RequestInit).body))
    );
    expect(bodies[0].reply_to).toBe("dallaspeters@gmail.com");
    expect(bodies[1]).not.toHaveProperty("reply_to");
  });

  it("never sends from another site's address", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmail(MAIL);
    const body = String(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body
    );
    expect(body).not.toMatch(ADDISON);
  });

  it("refuses without a key, and does not touch the network", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendEmail(MAIL)).rejects.toBeInstanceOf(
      EmailNotConfiguredError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a whitespace key as missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "   ");
    await expect(sendEmail(MAIL)).rejects.toBeInstanceOf(
      EmailNotConfiguredError
    );
  });

  it("throws on a non-2xx with Resend's status and reason", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"Domain is not verified"}', { status: 403 })
    );
    await expect(sendEmail(MAIL)).rejects.toThrow(NOT_VERIFIED);
  });

  it("surfaces a network failure rather than reporting success", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendEmail(MAIL)).rejects.toThrow("Failed to fetch");
  });
});
