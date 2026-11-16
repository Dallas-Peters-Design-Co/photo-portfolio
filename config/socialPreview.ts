export const SOCIAL_PREVIEW_OPTIONS = [
  { group: "Instagram", id: "instagram-post", label: "Post" },
  { group: "Instagram", id: "instagram-story", label: "Story / Reel" },
  { group: "Facebook", id: "facebook-post", label: "Post" },
  { group: "Facebook", id: "facebook-cover", label: "Page cover" },
  { group: "TikTok", id: "tiktok-post", label: "Video / photo post" },
  { group: "LinkedIn", id: "linkedin-post", label: "Post" },
  { group: "LinkedIn", id: "linkedin-page", label: "Company page cover" },
  { group: "LinkedIn", id: "linkedin-banner", label: "Profile banner" },
  { group: "X", id: "x-post", label: "Post" },
  { group: "Pinterest", id: "pinterest-pin", label: "Pin" },
  { group: "YouTube", id: "youtube-video", label: "Video thumbnail" },
] as const;

export type SocialPreviewId =
  | (typeof SOCIAL_PREVIEW_OPTIONS)[number]["id"]
  | "artwork";

export const isSocialPreviewId = (value: unknown): value is SocialPreviewId =>
  value === "artwork" ||
  SOCIAL_PREVIEW_OPTIONS.some((option) => option.id === value);
