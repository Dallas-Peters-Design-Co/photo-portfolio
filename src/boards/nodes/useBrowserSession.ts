import { type FormEvent, type MouseEvent, useRef, useState } from "react";
import {
  type BrowserViewport,
  browserConfigOf,
} from "../../../config/nodes/browser.js";
import {
  type BrowseRequest,
  type BrowseStep,
  browserApi,
} from "../../services/browserService";
import type { BoardItem } from "../../types";

/**
 * A browser node's browsing: where it is, the page to click on, going back,
 * and taking the screenshot. Each step is a call to the server's browser
 * (services/browserService.ts); what has to outlast the step (where it is,
 * the sealed session, the screenshot) goes into the node's config.
 */

export interface Preview {
  height: number;
  src: string;
  width: number;
}

const SHOOTING = "Screenshotting…";
const OPENING = "Opening…";

export const useBrowserSession = (
  item: BoardItem,
  onConfigChange: (config: Record<string, unknown>) => void,
  onCaptured: () => void
) => {
  const initial = browserConfigOf(item.config);
  // Async steps finish after other edits: patch the config as it is then.
  const latest = useRef(item.config);
  latest.current = item.config;
  const update = (patch: Record<string, unknown>) =>
    onConfigChange({ ...(latest.current ?? {}), ...patch });

  const [address, setAddress] = useState(initial.pageUrl || initial.url);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [back, setBack] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [enter, setEnter] = useState(true);

  const request = (more: Partial<BrowseRequest>): BrowseRequest => {
    const now = browserConfigOf(latest.current);
    return {
      sealedLogin: now.sealedLogin || undefined,
      session: now.session || undefined,
      slug: item.id.slice(0, 12),
      url: now.pageUrl || now.url,
      viewport: now.viewport,
      ...more,
    };
  };

  const run = async (
    label: string,
    more: Partial<BrowseRequest>
  ): Promise<BrowseStep | null> => {
    const req = request(more);
    if (!req.url) {
      setError("Enter an address first.");
      return null;
    }
    setBusy(label);
    setError(null);
    try {
      return await (label === SHOOTING
        ? browserApi.capture(req)
        : browserApi.step(req));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const go = async (more: Partial<BrowseRequest>, remember = true) => {
    const before = browserConfigOf(latest.current).pageUrl;
    const res = await run(OPENING, more);
    if (!res) {
      return;
    }
    if (remember && before && before !== res.url) {
      setBack((was) => [...was, before].slice(-30));
    }
    setPreview(
      res.preview
        ? { height: res.previewHeight, src: res.preview, width: res.width }
        : null
    );
    setAddress(res.url);
    const start = browserConfigOf(latest.current).url;
    update({
      pageUrl: res.url,
      session: res.session,
      title: res.title,
      url: start || res.url,
    });
  };

  const open = (e: FormEvent) => {
    e.preventDefault();
    const url = address.trim();
    if (url) {
      go({ url }).catch(() => undefined);
    }
  };

  const goBack = () => {
    const previous = back.at(-1);
    if (previous) {
      setBack((was) => was.slice(0, -1));
      go({ url: previous }, false).catch(() => undefined);
    }
  };

  const clickPage = (e: MouseEvent<HTMLImageElement>) => {
    if (!preview || busy) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (preview.width / rect.width);
    const y = (e.clientY - rect.top) * (preview.height / rect.height);
    const text = typed;
    setTyped("");
    go({ click: { x, y }, enter: text ? enter : false, text }).catch(
      () => undefined
    );
  };

  const screenshot = async () => {
    const res = await run(SHOOTING, {});
    if (!res?.image) {
      return;
    }
    update({
      captureHeight: res.image.height,
      captureUrl: res.image.url,
      captureWidth: res.image.width,
      pageUrl: res.url,
      session: res.session,
      title: res.title,
    });
    onCaptured();
  };

  const setViewport = (viewport: BrowserViewport) => {
    update({ viewport });
    if (preview) {
      go({ viewport }, false).catch(() => undefined);
    }
  };

  return {
    address,
    busy,
    canGoBack: back.length > 0,
    clickPage,
    enter,
    error,
    go,
    goBack,
    open,
    preview,
    screenshot,
    setAddress,
    setEnter,
    setTyped,
    setViewport,
    typed,
    update,
  };
};

export type BrowserSession = ReturnType<typeof useBrowserSession>;
