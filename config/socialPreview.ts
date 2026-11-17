export const SOCIAL_PREVIEW_OPTIONS = [
  { group: "Instagram", id: "instagram-post", label: "Post" },
  { group: "Instagram", id: "instagram-story", label: "Story / Reel" },
  { group: "Facebook", id: "facebook-post", label: "Post" },
  { group: "Facebook", id: "facebook-cover", label: "Page cover" },
  { group: "Facebook", id: "facebook-event", label: "Event" },
  { group: "TikTok", id: "tiktok-post", label: "Video / photo post" },
  { group: "LinkedIn", id: "linkedin-post", label: "Post" },
  { group: "LinkedIn", id: "linkedin-page", label: "Company page cover" },
  { group: "LinkedIn", id: "linkedin-banner", label: "Profile banner" },
  { group: "X", id: "x-post", label: "Post" },
  { group: "Pinterest", id: "pinterest-pin", label: "Pin" },
  { group: "YouTube", id: "youtube-video", label: "Video thumbnail" },
  {
    group: "Google Business",
    id: "google-business-profile",
    label: "Profile (Maps and Search)",
  },
  {
    group: "Google Business",
    id: "google-business-post",
    label: "Post / update",
  },
  { group: "ChatGPT", id: "chatgpt-profile", label: "Business profile" },
  { group: "ChatGPT", id: "chatgpt-ad", label: "Ad in a conversation" },
] as const;

export type SocialPreviewId =
  | (typeof SOCIAL_PREVIEW_OPTIONS)[number]["id"]
  | "artwork";

export const isSocialPreviewId = (value: unknown): value is SocialPreviewId =>
  value === "artwork" ||
  SOCIAL_PREVIEW_OPTIONS.some((option) => option.id === value);

/**
 * Whose post a mock-up shows, as kept on a Social Preview node so a published
 * board shows it to visitors (src/boards/studio/socialBrand.tsx).
 */
export interface SocialBrand {
  /** "rolemodelsoftware", for @handles and Instagram names. */
  handle: string;
  initial: string;
  /** The logo to put in avatars and page logos, if the kit has one. */
  logoUrl: string | null;
  name: string;
  /** "rolemodelsoftware.com". */
  site: string;
}

const brandText = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** A node's saved brand, or null when it has none worth showing. */
export const cleanSocialBrand = (value: unknown): SocialBrand | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const name = brandText(raw.name);
  if (!name) {
    return null;
  }
  const logo = brandText(raw.logoUrl, 2000);
  return {
    handle: brandText(raw.handle) || "yourbrand",
    initial: brandText(raw.initial, 2) || name.charAt(0).toUpperCase(),
    logoUrl: logo.startsWith("https://") ? logo : null,
    name,
    site: brandText(raw.site) || "yourbrand.com",
  };
};
