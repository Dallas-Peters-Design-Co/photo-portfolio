import type { PostHog } from "posthog-js";
import { siteConfig } from "../site";

/**
 * PostHog, loaded after the page is up rather than with it.
 *
 * posthog-js is about 240 KB minified, the largest single thing in the entry
 * bundle, and nothing on screen depends on it. So the library is fetched in its
 * own chunk once the browser is idle, and this module stands in for it until
 * then: calls made before it arrives are queued and replayed in order, so an
 * early `capture` is delayed, never lost.
 *
 * The trade: errors thrown in the first moment of a page load, before the
 * library has loaded, are not captured. The initial pageview still is, because
 * init records the URL the visitor is on when it runs.
 */

/**
 * Where the PostHog UI lives, as opposed to where events are sent.
 *
 * Behind a reverse proxy these are different hosts, and without ui_host the
 * toolbar and every "open in PostHog" link would point at the proxy, which
 * serves ingestion endpoints rather than the app.
 */
const posthogAppHost = import.meta.env.VITE_POSTHOG_UI_HOST;

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

/**
 * Events go to this site's own subdomain, which reverse-proxies PostHog. Being
 * first-party is the whole point — a shared vendor host is what tracking
 * blockers match on — so the host has to follow whichever site this bundle was
 * built for rather than being one baked-in value for both.
 *
 * VITE_POSTHOG_HOST still wins when set, which keeps local development pointed
 * straight at PostHog and leaves a way to bypass a misbehaving proxy without
 * shipping a code change.
 */
const posthogHost =
  import.meta.env.VITE_POSTHOG_HOST || siteConfig.analyticsHost;

const reportMissingConfiguration = (variableName: string) => {
  if (import.meta.env.DEV) {
    throw new Error(
      `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`
    );
  }
};

/** The slice of the PostHog client the app calls. */
type Client = Pick<PostHog, "capture" | "identify" | "reset">;
type Method = keyof Client;
type Call = { [M in Method]: [M, Parameters<Client[M]>] }[Method];

const queue: Call[] = [];
let client: Client | null = null;

const replay = (target: Client, [method, args]: Call): void => {
  // The tuple keeps each method paired with its own argument list.
  (target[method] as (...a: typeof args) => unknown)(...args);
};

const load = async (key: string): Promise<void> => {
  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: posthogHost,
    capture_exceptions: {
      capture_console_errors: false,
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
    },
    // Leaves capture_pageview as 'history_change', which this defaults version
    // selects. That is the right choice here: the app is a client-side router,
    // so route changes must register as pageviews rather than only the first
    // load.
    defaults: "2026-05-30",
    ui_host: posthogAppHost,
  });
  client = posthog;
  for (const call of queue.splice(0)) {
    replay(posthog, call);
  }
};

/** Once the page has painted and the main thread is free. */
const whenIdle = (run: () => void): void => {
  const start = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 1500);
    }
  };
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
};

// The ingestion host falls back to the site's proxy; the key and app host
// remain required for a configured browser client.
const configured = Boolean(posthogKey && posthogAppHost);
if (posthogKey && posthogAppHost) {
  whenIdle(() => {
    load(posthogKey).catch(() => {
      // Analytics failing to load (a blocker, offline) must not surface as an
      // error in the app. Queued events are simply dropped.
      queue.length = 0;
    });
  });
} else {
  reportMissingConfiguration(
    posthogKey ? "VITE_POSTHOG_UI_HOST" : "VITE_POSTHOG_KEY"
  );
}

const call =
  <M extends Method>(method: M) =>
  (...args: Parameters<Client[M]>): void => {
    if (!configured) {
      return;
    }
    if (client) {
      replay(client, [method, args] as Call);
      return;
    }
    queue.push([method, args] as Call);
  };

const posthog = {
  capture: call("capture"),
  identify: call("identify"),
  reset: call("reset"),
};

export default posthog;
