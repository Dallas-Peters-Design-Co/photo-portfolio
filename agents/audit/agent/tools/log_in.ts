import { installAgentBrowser } from "@eve/agent-browser/sandbox";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { BROWSER_SESSION } from "../lib/browser-session";

// Selectors tried in order when LOGIN_USER_SELECTOR is not set.
const USER_SELECTORS = [
  'input[autocomplete="username"]',
  'input[type="email"]',
  'input[name*="email" i]',
  'input[name*="user" i]',
  'input[name*="login" i]',
  'input[id*="email" i]',
  'input[id*="user" i]',
  'input[type="text"]',
];
const PASS_SELECTORS = ['input[autocomplete="current-password"]', 'input[type="password"]'];

// Marks the visible username and password fields with data-eve-login so the
// fill commands can target them with a fixed selector. Returns which it found.
function tagFieldsScript(userSelectors: string[], passSelectors: string[]): string {
  return `(() => {
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const pick = (sels) => {
    for (const s of sels) {
      const el = [...document.querySelectorAll(s)].find(visible);
      if (el) return el;
    }
    return null;
  };
  document.querySelectorAll('[data-eve-login]').forEach((el) => el.removeAttribute('data-eve-login'));
  const pass = pick(${JSON.stringify(passSelectors)});
  const user = pick(${JSON.stringify(userSelectors)});
  if (user && user !== pass) user.setAttribute('data-eve-login', 'user');
  if (pass) pass.setAttribute('data-eve-login', 'pass');
  return JSON.stringify({ user: !!user && user !== pass, pass: !!pass });
})()`;
}

const USER_FIELD = '[data-eve-login="user"]';
const PASS_FIELD = '[data-eve-login="pass"]';

export default defineTool({
  description:
    "Log in to the app under audit with the stored test account. Call this before browsing any page " +
    "that needs a login. The credentials stay on the server; you never see them. After it succeeds, " +
    "the browser__* tools browse as the logged-in user.",
  inputSchema: z.object({
    loginUrl: z
      .string()
      .url()
      .optional()
      .describe("The app's sign-in page. Omit it to use the server's LOGIN_URL setting."),
  }),
  async execute({ loginUrl }, ctx) {
    const username = process.env.LOGIN_USER;
    const password = process.env.LOGIN_PASS;
    const url = loginUrl ?? process.env.LOGIN_URL;
    if (!username || !password) {
      return { ok: false, reason: "LOGIN_USER and LOGIN_PASS are not set on the agent server." };
    }
    if (!url) {
      return { ok: false, reason: "No login URL. Pass loginUrl, or set LOGIN_URL on the agent server." };
    }

    // Only server configuration can authorize where the stored account is used.
    const isTrustedLoginUrl = (candidate: string): boolean => {
      try {
        const trusted = new URL(process.env.LOGIN_URL ?? "");
        const target = new URL(candidate);
        return (
          (trusted.protocol === "https:" || trusted.protocol === "http:") &&
          target.origin === trusted.origin
        );
      } catch {
        return false;
      }
    };
    if (!isTrustedLoginUrl(url)) {
      return { ok: false, reason: "The login URL must match the server's configured LOGIN_URL origin." };
    }

    const sandbox = await ctx.getSandbox();
    const signal = ctx.abortSignal;

    // Secrets and page values travel only as environment variables, never in
    // the command string, so they don't appear in logs or tool results.
    const env = {
      AB_URL: url,
      AB_USER: username,
      AB_PASS: password,
      AB_TAG_JS: tagFieldsScript(
        process.env.LOGIN_USER_SELECTOR ? [process.env.LOGIN_USER_SELECTOR] : USER_SELECTORS,
        process.env.LOGIN_PASS_SELECTOR ? [process.env.LOGIN_PASS_SELECTOR] : PASS_SELECTORS,
      ),
      AB_SUBMIT: process.env.LOGIN_SUBMIT_SELECTOR ?? "",
    };
    const ab = async (args: string) => {
      // Recheck the active page after navigation and username-step redirects.
      if (args.startsWith("fill ") || args.startsWith("click ") || args.startsWith("press ")) {
        const current = await sandbox.run({
          command: `agent-browser --session ${BROWSER_SESSION} get url`, env, signal,
        });
        if (current.exitCode !== 0 || !isTrustedLoginUrl(current.stdout.trim())) {
          return { exitCode: 1, stdout: "", stderr: "The login page left the trusted origin." };
        }
      }
      return sandbox.run({ command: `agent-browser --session ${BROWSER_SESSION} ${args}`, env, signal });
    };

    const tagFields = async () => {
      const result = await ab('eval "$AB_TAG_JS"');
      const match = result.stdout.match(/\{[^{}]*"user"[^{}]*\}/);
      if (!match) return { user: false, pass: false };
      try {
        return JSON.parse(match[0].replace(/\\"/g, '"')) as { user: boolean; pass: boolean };
      } catch {
        return { user: false, pass: false };
      }
    };
    const settle = async () => {
      await ab("wait 1500");
      await ab("wait --load load");
    };
    const submit = () => (env.AB_SUBMIT ? ab('click "$AB_SUBMIT"') : ab("press Enter"));

    // The browser extension installs on first use; make sure it exists first.
    const probe = await sandbox.run({ command: "command -v agent-browser", signal });
    if (probe.exitCode !== 0) await installAgentBrowser(sandbox, { abortSignal: signal });

    const opened = await ab('open "$AB_URL"');
    if (opened.exitCode !== 0) {
      return { ok: false, reason: `Could not open the login page: ${opened.stderr.slice(0, 300)}` };
    }
    await settle();

    let fields = await tagFields();
    if (!fields.user && !fields.pass) {
      return { ok: false, reason: "No username or password field found on the login page." };
    }

    if (fields.user) {
      const filled = await ab(`fill '${USER_FIELD}' "$AB_USER"`);
      if (filled.exitCode !== 0) return { ok: false, reason: "Could not type into the username field." };
    }

    // Two-step logins show the password field only after the username step.
    if (!fields.pass) {
      await submit();
      await settle();
      fields = await tagFields();
      if (!fields.pass) {
        return { ok: false, reason: "The password field did not appear after the username step." };
      }
    }

    const filledPass = await ab(`fill '${PASS_FIELD}' "$AB_PASS"`);
    if (filledPass.exitCode !== 0) return { ok: false, reason: "Could not type into the password field." };
    await submit();
    await settle();

    const after = await tagFields();
    const current = (await ab("get url")).stdout.trim();
    if (after.pass) {
      return {
        ok: false,
        currentUrl: current,
        reason:
          "A password field is still showing, so the login probably failed. Take a snapshot to read " +
          "the error, then report it. Do not retry with other credentials.",
      };
    }
    return { ok: true, currentUrl: current };
  },
});
