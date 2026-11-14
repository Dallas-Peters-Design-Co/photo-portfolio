import type { Browser, BrowserContext, Page } from "playwright-core";
import { resolvePublicUrl } from "./publicHost.js";
import { type CaptureResult, captureFullPage, launch } from "./screenshot.js";

/**
 * One step of a board browser node: open a page (logged in when the node has
 * a login), optionally click or type on it, and hand back what it shows.
 *
 * A serverless function can't keep a browser open between requests, so every
 * step is a fresh browser. What carries over is the session: the cookies and
 * storage the site set, returned after each step and sent back with the next
 * (sealed, by the endpoint). So the login happens once, and later steps open
 * the page already signed in, the way a real browser would.
 *
 * Every request the page makes is checked against private and internal
 * addresses, not just the first: a page could otherwise send the browser
 * into this server's own network.
 */

export interface BrowserLogin {
  /** Where the sign-in form is; the page itself when empty. */
  loginUrl: string;
  password: string;
  username: string;
}

/** Playwright's storage state: the cookies and local storage of a session. */
export type Session = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface BrowseInput {
  /** Checks a host before the page may contact it. Public hosts only, by default. */
  allowHost?: (host: string) => Promise<boolean>;
  /** Store a full-page capture under this prefix instead of a preview. */
  capturePrefix?: string;
  /** Where to click, in page pixels (the preview's own coordinates). */
  click?: { x: number; y: number } | null;
  login: BrowserLogin | null;
  /** Pressed after the click: Enter submits what was typed. */
  pressEnter?: boolean;
  session: Session | null;
  /** Typed after the click, into whatever it focused. */
  text?: string;
  url: string;
  width: number;
}

export interface BrowseResult {
  /** The full-page capture, when one was asked for. */
  image: CaptureResult | null;
  /** A JPEG of the page as a data URL, for the node to show and click on. */
  preview: string | null;
  previewHeight: number;
  session: Session;
  title: string;
  url: string;
  width: number;
}

const NAV_TIMEOUT_MS = 20_000;
const LOAD_GRACE_MS = 6000;
const IDLE_GRACE_MS = 2500;
const SETTLE_MS = 700;
/** The preview stops here: enough to find the next link, small enough to send. */
const PREVIEW_MAX_HEIGHT = 3200;
/** A session bigger than this is mostly local storage; the cookies are kept. */
const MAX_SESSION_CHARS = 150_000;

const visible = (selectors: string[]) =>
  selectors.map((s) => `${s}:visible`).join(", ");

const PASSWORD = visible(["input[type=password]"]);
const USERNAME = visible([
  "input[type=email]",
  "input[autocomplete=username]",
  "input[autocomplete=email]",
  "input[name*=user i]",
  "input[name*=email i]",
  "input[name*=login i]",
  "input[id*=user i]",
  "input[id*=email i]",
  "input[type=text]",
]);

const publicHost = async (host: string): Promise<boolean> =>
  (await resolvePublicUrl(host)).ok;

const settle = async (page: Page) => {
  await page
    .waitForLoadState("load", { timeout: LOAD_GRACE_MS })
    .catch(() => undefined);
  await page
    .waitForLoadState("networkidle", { timeout: IDLE_GRACE_MS })
    .catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
};

const open = async (page: Page, url: string) => {
  await page.goto(url, {
    timeout: NAV_TIMEOUT_MS,
    waitUntil: "domcontentloaded",
  });
  await settle(page);
};

/** A sign-in page's address, for the forms that ask for the username alone first. */
const SIGN_IN_PATH = /log-?in|sign-?in|auth|sso|session/i;

/**
 * Whether the page is asking to sign in: a password field, or a username
 * field on a page whose address says it's the sign-in.
 */
const asksToSignIn = async (page: Page): Promise<boolean> => {
  if ((await page.locator(PASSWORD).count()) > 0) {
    return true;
  }
  const path = new URL(page.url()).pathname;
  return SIGN_IN_PATH.test(path) && (await page.locator(USERNAME).count()) > 0;
};

/**
 * Fills a sign-in form, whichever of the two common shapes it is: username
 * and password together, or the username first and the password on the next
 * screen. True when a password was submitted.
 */
export const logIn = async (
  page: Page,
  { password, username }: BrowserLogin
): Promise<boolean> => {
  const pass = page.locator(PASSWORD).first();
  const user = page.locator(USERNAME).first();
  if ((await pass.count()) === 0) {
    if ((await user.count()) === 0) {
      return false;
    }
    await user.fill(username);
    await user.press("Enter");
    await pass
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => undefined);
    if ((await pass.count()) === 0) {
      return false;
    }
  } else if ((await user.count()) > 0) {
    await user.fill(username);
  }
  await pass.fill(password);
  await pass.press("Enter");
  await page
    .waitForLoadState("domcontentloaded", { timeout: NAV_TIMEOUT_MS })
    .catch(() => undefined);
  await settle(page);
  return true;
};

/** Clicks at a point on the page, scrolling it into view first. */
const clickAt = async (page: Page, { x, y }: { x: number; y: number }) => {
  const scrolled = await page.evaluate((target) => {
    window.scrollTo(0, Math.max(0, target - window.innerHeight / 2));
    return window.scrollY;
  }, y);
  await page.mouse.click(x, y - scrolled);
};

const trimSession = (session: Session): Session =>
  JSON.stringify(session).length <= MAX_SESSION_CHARS
    ? session
    : { cookies: session.cookies, origins: [] };

/** The open tab: a link that opens a new one carries on there. */
interface Tab {
  context: BrowserContext;
  page: Page;
}

/**
 * A context carrying the session, opened on the page asked for (signing in
 * on the way when there's a login and the site wants one).
 */
const openSite = async (
  browser: Browser,
  input: BrowseInput,
  session: Session | null,
  allowHost: (host: string) => Promise<boolean>
): Promise<Tab> => {
  const context = await browser.newContext({
    bypassCSP: true,
    deviceScaleFactor: input.capturePrefix ? 2 : 1,
    storageState: session ?? undefined,
    viewport: { height: Math.round(input.width * 0.66), width: input.width },
  });
  try {
    const checked = new Map<string, Promise<boolean>>();
    await context.route("**/*", async (route) => {
      const { hostname, protocol } = new URL(route.request().url());
      if (protocol === "data:" || protocol === "blob:") {
        return route.continue();
      }
      if (!checked.has(hostname)) {
        checked.set(
          hostname,
          allowHost(hostname).catch(() => false)
        );
      }
      return (await checked.get(hostname)) ? route.continue() : route.abort();
    });
    const tab: Tab = { context, page: await context.newPage() };
    // A link that opens a new tab carries on there, as it would for a person.
    context.on("page", (opened) => {
      tab.page = opened;
    });

    const { login } = input;
    if (login && !session && login.loginUrl) {
      await open(tab.page, login.loginUrl);
      await logIn(tab.page, login);
    }
    await open(tab.page, input.url);
    if (login && (await asksToSignIn(tab.page))) {
      // Signed out, or the session ran out: sign in, then back to the page.
      const wanted = input.url;
      await logIn(tab.page, login);
      if (tab.page.url() !== wanted && !(await asksToSignIn(tab.page))) {
        await open(tab.page, wanted);
      }
    }
    return tab;
  } catch (e) {
    await context.close().catch(() => undefined);
    throw e;
  }
};

/**
 * The sessions to try, fullest first: as kept, then its cookies alone, then
 * none.
 *
 * A session that a site's own page left behind can stop the next visit from
 * loading at all (Chromium gave up on pretext.viask.ai/login with
 * ERR_INSUFFICIENT_RESOURCES once a session was carried in, three times
 * running). Being signed out and asked to sign in again is a page; an error
 * is nothing. So a page that won't open with the session is tried with less.
 */
const sessionsToTry = (session: Session | null): (Session | null)[] => {
  if (!session) {
    return [null];
  }
  const cookiesOnly: Session = { cookies: session.cookies, origins: [] };
  return session.origins.length > 0
    ? [session, cookiesOnly, null]
    : [session, null];
};

const openWithFallback = async (
  browser: Browser,
  input: BrowseInput,
  allowHost: (host: string) => Promise<boolean>
): Promise<Tab> => {
  const tries = sessionsToTry(input.session);
  let failure: unknown = null;
  for (const [i, session] of tries.entries()) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one attempt at a time, each only if the last failed
      const tab = await openSite(browser, input, session, allowHost);
      if (i > 0) {
        console.warn(
          `[browser node] opened ${new URL(input.url).hostname} on try ${i + 1} of ${tries.length} (less of the session)`
        );
      }
      return tab;
    } catch (e) {
      failure = e;
    }
  }
  throw failure;
};

export const browse = async (input: BrowseInput): Promise<BrowseResult> => {
  const allowHost = input.allowHost ?? publicHost;
  const browser = await launch();
  try {
    const tab = await openWithFallback(browser, input, allowHost);
    const { context } = tab;
    let { page } = tab;

    if (input.click) {
      await clickAt(page, input.click);
      await page.waitForTimeout(400);
      // The click may have opened a new tab: carry on there.
      ({ page } = tab);
      await settle(page);
    }
    if (input.text) {
      await page.keyboard.type(input.text.slice(0, 2000), { delay: 15 });
    }
    if (input.pressEnter) {
      await page.keyboard.press("Enter");
      ({ page } = tab);
      await settle(page);
    }

    const session = trimSession(await context.storageState());
    const title = (await page.title().catch(() => "")).slice(0, 200);
    if (input.capturePrefix) {
      const image = await captureFullPage(
        page,
        input.width,
        input.capturePrefix
      );
      return {
        image,
        preview: null,
        previewHeight: 0,
        session,
        title,
        url: page.url(),
        width: input.width,
      };
    }
    const fullHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    const previewHeight = Math.min(fullHeight, PREVIEW_MAX_HEIGHT);
    await page.evaluate(() => window.scrollTo(0, 0));
    const jpeg = await page.screenshot({
      clip: { height: previewHeight, width: input.width, x: 0, y: 0 },
      fullPage: true,
      quality: 62,
      type: "jpeg",
    });
    return {
      image: null,
      preview: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      previewHeight,
      session,
      title,
      url: page.url(),
      width: input.width,
    };
  } finally {
    await browser.close();
  }
};
