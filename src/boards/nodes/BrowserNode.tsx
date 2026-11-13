import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft01Icon from "@hugeicons-pro/core-stroke-standard/ArrowLeft01Icon";
import Camera01Icon from "@hugeicons-pro/core-stroke-standard/Camera01Icon";
import LockKeyIcon from "@hugeicons-pro/core-stroke-standard/LockKeyIcon";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type BrowserNodeConfig,
  type BrowserViewport,
  browserConfigOf,
} from "../../../config/nodes/browser.js";
import { reviewAccentStyle } from "../../components/review/ReviewMarkup";
import { browserApi } from "../../services/browserService";
import { useSiteSettings } from "../../theme/SiteSettingsProvider";
import type { BoardItem } from "../../types";
import {
  BrowserMarkup,
  BrowserNotes,
  type MarkupTool,
  MarkupTools,
} from "./BrowserMarkup";
import { type BrowserSession, useBrowserSession } from "./useBrowserSession";
import "../../components/review/reviewMarkup.css";
import "./BrowserNode.css";

/**
 * A browser on the board (config/nodes/browser.ts).
 *
 * Type an address and the page opens here, signed in when the node has a
 * login. Click the page to follow a link or press a button; to fill in a
 * field, type into "Type on next click" first, then click the field. Back
 * steps to the previous page. Screenshot captures the whole page you're on,
 * and the node becomes that picture, to mark up with numbered notes stacked
 * on its right.
 *
 * Each step is a real browser on the server and takes a few seconds; the
 * page is opened afresh each time with the site's cookies carried over, so
 * anything that only lived in the page (an open menu) is gone by the next
 * step. Links, forms and signed-in pages carry over fine.
 */

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BrowserNode({
  item,
  onConfigChange,
  readOnly,
}: {
  item: BoardItem;
  onConfigChange: (config: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const cfg = browserConfigOf(item.config);
  const { settings } = useSiteSettings();
  const [browsing, setBrowsing] = useState(cfg.capture === null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [tool, setTool] = useState<MarkupTool>("pin");
  const [selected, setSelected] = useState<string | null>(null);
  const session = useBrowserSession(item, onConfigChange, () =>
    setBrowsing(false)
  );
  const view = useRef<HTMLDivElement>(null);

  // The canvas zooms on the wheel; over the page it should scroll instead.
  useEffect(() => {
    const el = view.current;
    const keep = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        e.stopPropagation();
      }
    };
    el?.addEventListener("wheel", keep, { passive: true });
    return () => el?.removeEventListener("wheel", keep);
  }, []);

  const showMarkup = !browsing && cfg.capture !== null;

  return (
    <div
      className="browser-node"
      style={reviewAccentStyle(settings.theme.accent)}
    >
      <div className="browser-node__bar">
        {showMarkup ? (
          <MarkupBar
            cfg={cfg}
            onBrowse={() => setBrowsing(true)}
            onTool={setTool}
            readOnly={readOnly}
            tool={tool}
          />
        ) : (
          <BrowseBar
            cfg={cfg}
            loginOpen={loginOpen}
            onLogin={() => setLoginOpen((was) => !was)}
            readOnly={readOnly}
            session={session}
          />
        )}
      </div>

      {loginOpen && !showMarkup ? (
        <LoginForm
          loginUser={cfg.loginUser}
          onDone={() => setLoginOpen(false)}
          onForget={() => {
            session.update({ loginUser: "", sealedLogin: "", session: "" });
            setLoginOpen(false);
          }}
          onSaved={(sealedLogin, loginUser) => {
            // A new login starts a new session: the old cookies were someone else's.
            session.update({ loginUser, sealedLogin, session: "" });
            setLoginOpen(false);
          }}
        />
      ) : null}

      <div className="browser-node__view" ref={view}>
        {showMarkup && cfg.capture ? (
          <BrowserMarkup
            capture={cfg.capture}
            marks={cfg.marks}
            notes={cfg.notes}
            onChange={(patch) => session.update({ ...patch })}
            onSelectNote={setSelected}
            readOnly={readOnly}
            selected={selected}
            tool={tool}
          />
        ) : (
          <PageView cfg={cfg} readOnly={readOnly} session={session} />
        )}
        {session.busy ? (
          <p className="browser-node__busy">{session.busy}</p>
        ) : null}
      </div>

      {!showMarkup && session.preview && !readOnly ? (
        <TypeAhead session={session} />
      ) : null}
      {session.error ? (
        <p className="browser-node__error" role="alert">
          {session.error}
        </p>
      ) : null}

      {showMarkup ? (
        <BrowserNotes
          notes={cfg.notes}
          onChange={(notes) => session.update({ notes })}
          onSelect={setSelected}
          readOnly={readOnly}
          selected={selected}
        />
      ) : null}
    </div>
  );
}

function MarkupBar({
  cfg,
  onBrowse,
  onTool,
  readOnly,
  tool,
}: {
  cfg: BrowserNodeConfig;
  onBrowse: () => void;
  onTool: (tool: MarkupTool) => void;
  readOnly: boolean;
  tool: MarkupTool;
}) {
  return (
    <>
      {readOnly ? null : <MarkupTools onTool={onTool} tool={tool} />}
      <span className="browser-node__page" title={cfg.pageUrl}>
        {cfg.title || cfg.pageUrl}
      </span>
      {readOnly ? null : (
        <button
          className="browser-node__button"
          onClick={onBrowse}
          onPointerDown={stop}
          type="button"
        >
          Browse again
        </button>
      )}
    </>
  );
}

function BrowseBar({
  cfg,
  loginOpen,
  onLogin,
  readOnly,
  session,
}: {
  cfg: BrowserNodeConfig;
  loginOpen: boolean;
  onLogin: () => void;
  readOnly: boolean;
  session: BrowserSession;
}) {
  const busy = session.busy !== null;
  const who = cfg.loginUser ? `Signed in as ${cfg.loginUser}` : "Add a login";
  return (
    <>
      <button
        aria-label="Back"
        className="browser-node__icon"
        disabled={!session.canGoBack || busy}
        onClick={session.goBack}
        onPointerDown={stop}
        type="button"
      >
        <HugeiconsIcon aria-hidden icon={ArrowLeft01Icon} size={14} />
      </button>
      <form className="browser-node__address" onSubmit={session.open}>
        <input
          aria-label="Address"
          className="browser-node__url"
          disabled={readOnly}
          onChange={(e) => session.setAddress(e.target.value)}
          onPointerDown={stop}
          placeholder="https://"
          value={session.address}
        />
      </form>
      <select
        aria-label="Width"
        className="browser-node__viewport"
        disabled={readOnly || busy}
        onChange={(e) => session.setViewport(e.target.value as BrowserViewport)}
        onPointerDown={stop}
        value={cfg.viewport}
      >
        <option value="desktop">Desktop</option>
        <option value="mobile">Phone</option>
      </select>
      <button
        aria-expanded={loginOpen}
        aria-label={who}
        className="browser-node__icon"
        data-on={cfg.loginUser ? "" : undefined}
        disabled={readOnly}
        onClick={onLogin}
        onPointerDown={stop}
        title={who}
        type="button"
      >
        <HugeiconsIcon aria-hidden icon={LockKeyIcon} size={14} />
      </button>
      <button
        className="browser-node__button browser-node__button--primary"
        disabled={readOnly || busy || !(cfg.pageUrl || session.preview)}
        onClick={() => {
          session.screenshot().catch(() => undefined);
        }}
        onPointerDown={stop}
        type="button"
      >
        <HugeiconsIcon aria-hidden icon={Camera01Icon} size={14} />
        Screenshot
      </button>
    </>
  );
}

function PageView({
  cfg,
  readOnly,
  session,
}: {
  cfg: BrowserNodeConfig;
  readOnly: boolean;
  session: BrowserSession;
}) {
  const { preview } = session;
  if (preview) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: the page is clicked where the pointer is; there's no keyboard equivalent of "click there"
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
      <img
        alt={cfg.title || "The page"}
        className="browser-node__page-shot"
        data-busy={session.busy ? "" : undefined}
        draggable={false}
        height={preview.height}
        onClick={session.clickPage}
        onPointerDown={stop}
        src={preview.src}
        width={preview.width}
      />
    );
  }
  return (
    <div className="browser-node__empty">
      {cfg.pageUrl ? (
        <button
          className="browser-node__button"
          disabled={session.busy !== null || readOnly}
          onClick={() => {
            session.go({}, false).catch(() => undefined);
          }}
          onPointerDown={stop}
          type="button"
        >
          Show {cfg.title || "the page"}
        </button>
      ) : (
        <p>
          Enter an address above. Add a login with the lock if the site needs
          one.
        </p>
      )}
    </div>
  );
}

function TypeAhead({ session }: { session: BrowserSession }) {
  return (
    <div className="browser-node__type">
      <input
        aria-label="Type on next click"
        onChange={(e) => session.setTyped(e.target.value)}
        onPointerDown={stop}
        placeholder="Type here, then click the field it goes in"
        value={session.typed}
      />
      <label onPointerDown={stop}>
        <input
          checked={session.enter}
          onChange={(e) => session.setEnter(e.target.checked)}
          type="checkbox"
        />
        then Enter
      </label>
    </div>
  );
}

/** The login, typed once and sealed by the server. The password isn't kept here. */
function LoginForm({
  loginUser,
  onDone,
  onForget,
  onSaved,
}: {
  loginUser: string;
  onDone: () => void;
  onForget: () => void;
  onSaved: (sealedLogin: string, loginUser: string) => void;
}) {
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState(loginUser);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const sealed = await browserApi.seal({ loginUrl, password, username });
      setPassword("");
      onSaved(sealed.sealedLogin, sealed.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that login");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="browser-node__login" onPointerDown={stop} onSubmit={save}>
      <p className="browser-node__login-note">
        Saved encrypted on the server. The password is never shown again.
      </p>
      <input
        aria-label="Sign-in page (optional)"
        onChange={(e) => setLoginUrl(e.target.value)}
        placeholder="Sign-in page, if it isn't where the site sends you"
        value={loginUrl}
      />
      <input
        aria-label="Username or email"
        autoComplete="off"
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username or email"
        value={username}
      />
      <input
        aria-label="Password"
        autoComplete="new-password"
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        value={password}
      />
      {error ? <p className="browser-node__error">{error}</p> : null}
      <div className="browser-node__login-actions">
        {loginUser ? (
          <button
            className="browser-node__button"
            onClick={onForget}
            type="button"
          >
            Forget login
          </button>
        ) : null}
        <button className="browser-node__button" onClick={onDone} type="button">
          Cancel
        </button>
        <button
          className="browser-node__button browser-node__button--primary"
          disabled={saving || !(username && password)}
          type="submit"
        >
          {saving ? "Saving…" : "Save login"}
        </button>
      </div>
    </form>
  );
}
