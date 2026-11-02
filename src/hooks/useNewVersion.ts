import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Says so when a newer build of the site has been deployed than the one this
 * tab is running, with a button to reload. A tab left open across a deploy
 * otherwise keeps showing the old app, and new features look missing.
 *
 * Checked when the tab comes back into focus and every few minutes, by asking
 * for the page's HTML and comparing its main script with the one loaded here.
 */

const EVERY_MS = 5 * 60 * 1000;
const MAIN_SCRIPT = /\/assets\/index-[\w-]+\.js/;

export const builtScript = (html: string): string | null =>
  MAIN_SCRIPT.exec(html)?.[0] ?? null;

const loadedScript = (): string | null => {
  for (const script of document.scripts) {
    const found = builtScript(script.src);
    if (found) {
      return found;
    }
  }
  return null;
};

export const useNewVersion = () => {
  useEffect(() => {
    const running = loadedScript();
    // The dev server has no built script to compare.
    if (!running) {
      return;
    }
    let told = false;
    const check = async () => {
      if (told || document.visibilityState !== "visible") {
        return;
      }
      try {
        const res = await fetch("/", { cache: "no-store" });
        const live = builtScript(await res.text());
        if (live && live !== running) {
          told = true;
          toast("A new version of the site is out", {
            action: { label: "Reload", onClick: () => location.reload() },
            duration: Number.POSITIVE_INFINITY,
          });
        }
      } catch {
        // Offline or mid-deploy: the next check will catch it.
      }
    };
    const timer = setInterval(() => void check(), EVERY_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
};
