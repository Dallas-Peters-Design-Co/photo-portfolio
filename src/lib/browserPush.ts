import { pushApi } from "../services/activityService";

/**
 * Browser notifications for the owner, through the service worker.
 *
 * The worker is registered here too, not only at page load: production
 * registers it on load, development does not at all, and a subscription
 * needs one either way.
 */

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

const supported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** The VAPID public key, base64url, as the bytes PushManager wants. */
export const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`;
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const registration = async (): Promise<ServiceWorkerRegistration> => {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    return existing;
  }
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
};

export const pushState = async (): Promise<PushState> => {
  if (!supported()) {
    return "unsupported";
  }
  const { configured } = await pushApi.config();
  if (!configured) {
    return "unconfigured";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
};

/** Asks permission, subscribes, and tells the server. */
export const enablePush = async (): Promise<PushState> => {
  if (!supported()) {
    return "unsupported";
  }
  const { configured, publicKey } = await pushApi.config();
  if (!(configured && publicKey)) {
    return "unconfigured";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "off";
  }
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      applicationServerKey: keyBytes(publicKey),
      userVisibleOnly: true,
    }));
  await pushApi.save(sub.toJSON());
  return "on";
};

export const disablePush = async (): Promise<PushState> => {
  if (!supported()) {
    return "unsupported";
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await pushApi.forget(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
};
