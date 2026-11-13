/**
 * Every social size a frame can be, with where each platform covers or crops
 * the picture. Checked against the platforms' own help and current guides in
 * November 2026; the sources are listed under docs/social-sizes.md.
 *
 * A safe zone is in the size's own pixels:
 *
 *   inset   the band round the edge that a crop or the app's buttons can hide
 *           (only the middle is sure to show everywhere)
 *   covers  something the platform draws on top: a profile photo, a logo
 *   round   the picture is shown in a circle (profile photos)
 *
 * Where a platform publishes nothing and nobody has measured it, there's no
 * zone, rather than a guessed one. Safe zones move when an app is redesigned:
 * check a real device before a big launch.
 */

export interface SafeCover {
  h: number;
  label: string;
  round?: boolean;
  w: number;
  x: number;
  y: number;
}

export interface SafeZone {
  covers?: SafeCover[];
  inset?: { bottom: number; left: number; right: number; top: number };
  /** What the inset is for, shown with the guide. */
  note: string;
  round?: boolean;
}

export interface SocialSize {
  group: string;
  h: number;
  id: string;
  label: string;
  safe?: SafeZone;
  w: number;
}

const inset = (top: number, right: number, bottom: number, left: number) => ({
  bottom,
  left,
  right,
  top,
});

/** A profile photo: square to upload, shown as a circle. */
const profile = (group: string, id: string, size: number): SocialSize => ({
  group,
  h: size,
  id,
  label: "Profile photo",
  safe: { note: "Shown as a circle", round: true },
  w: size,
});

/** Meta's published Reels and Stories zone (1080×1920). */
const META_VERTICAL: SafeZone = {
  inset: inset(269, 65, 672, 65),
  note: "Profile, caption and buttons (Meta)",
};

/** The profile grid shows every post at 3:4, cropping a square's sides. */
const IG_GRID_SQUARE: SafeZone = {
  inset: inset(0, 135, 0, 135),
  note: "Profile grid crop (3:4)",
};
const IG_GRID_PORTRAIT: SafeZone = {
  inset: inset(0, 34, 0, 34),
  note: "Profile grid crop (3:4)",
};

export const SOCIAL_SIZES: SocialSize[] = [
  // Instagram
  {
    group: "Instagram",
    h: 1080,
    id: "ig-square",
    label: "Post · square",
    safe: IG_GRID_SQUARE,
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1350,
    id: "ig-portrait",
    label: "Post · portrait",
    safe: IG_GRID_PORTRAIT,
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1440,
    id: "ig-portrait-grid",
    label: "Post · portrait 3:4",
    w: 1080,
  },
  {
    group: "Instagram",
    h: 566,
    id: "ig-landscape",
    label: "Post · landscape",
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1920,
    id: "ig-story",
    label: "Story / Reel",
    safe: META_VERTICAL,
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1920,
    id: "ig-reel-cover",
    label: "Reel cover",
    safe: { inset: inset(240, 0, 240, 0), note: "Profile grid crop (3:4)" },
    w: 1080,
  },
  profile("Instagram", "ig-profile", 320),

  // Facebook
  { group: "Facebook", h: 630, id: "fb-link", label: "Link / feed", w: 1200 },
  {
    group: "Facebook",
    h: 1080,
    id: "fb-square",
    label: "Post · square",
    w: 1080,
  },
  {
    group: "Facebook",
    h: 1350,
    id: "fb-portrait",
    label: "Post · portrait",
    w: 1080,
  },
  {
    group: "Facebook",
    h: 1920,
    id: "fb-story",
    label: "Story / Reel",
    safe: META_VERTICAL,
    w: 1080,
  },
  {
    group: "Facebook",
    h: 315,
    id: "fb-cover",
    label: "Page cover",
    // Phones show it at 640×360, which keeps the middle 560px of 851.
    safe: { inset: inset(0, 145, 0, 145), note: "Cropped on phones" },
    w: 851,
  },
  {
    group: "Facebook",
    h: 856,
    id: "fb-group-cover",
    label: "Group cover",
    w: 1640,
  },
  {
    group: "Facebook",
    h: 1005,
    id: "fb-event-cover",
    label: "Event cover",
    w: 1920,
  },
  profile("Facebook", "fb-profile", 320),

  // LinkedIn
  { group: "LinkedIn", h: 627, id: "li-post", label: "Post", w: 1200 },
  {
    group: "LinkedIn",
    h: 1080,
    id: "li-square",
    label: "Post · square",
    w: 1080,
  },
  {
    group: "LinkedIn",
    h: 1350,
    id: "li-portrait",
    label: "Post · portrait / carousel",
    w: 1080,
  },
  {
    group: "LinkedIn",
    h: 396,
    id: "li-banner",
    label: "Banner",
    safe: {
      covers: [
        { h: 304, label: "Profile photo", round: true, w: 304, x: 56, y: 212 },
      ],
      inset: inset(40, 160, 40, 420),
      note: "Profile photo, desktop (measured)",
    },
    w: 1584,
  },
  {
    group: "LinkedIn",
    h: 256,
    id: "li-company-cover",
    label: "Company page cover",
    safe: {
      covers: [{ h: 241, label: "Logo", w: 241, x: 45, y: 134 }],
      inset: inset(28, 150, 56, 340),
      note: "Page logo, desktop (measured)",
    },
    w: 1512,
  },
  {
    group: "LinkedIn",
    h: 720,
    id: "li-event-cover",
    label: "Event cover",
    w: 1280,
  },
  {
    group: "LinkedIn",
    h: 1080,
    id: "li-article-cover",
    label: "Article / newsletter cover",
    w: 1920,
  },
  profile("LinkedIn", "li-profile", 400),

  // X
  { group: "X", h: 675, id: "x-post", label: "Post", w: 1200 },
  { group: "X", h: 1080, id: "x-square", label: "Post · square", w: 1080 },
  { group: "X", h: 628, id: "x-card", label: "Link card", w: 1200 },
  {
    group: "X",
    h: 500,
    id: "x-header",
    label: "Header",
    // The profile photo also sits over the bottom-left; nobody publishes
    // where, so it isn't drawn.
    safe: { inset: inset(50, 150, 50, 150), note: "Cropped on phones" },
    w: 1500,
  },
  profile("X", "x-profile", 400),

  // Threads and Bluesky
  {
    group: "Threads",
    h: 1350,
    id: "threads-portrait",
    label: "Post · portrait",
    w: 1080,
  },
  { group: "Threads", h: 600, id: "threads-link", label: "Link", w: 1200 },
  {
    group: "Bluesky",
    h: 500,
    id: "bsky-banner",
    label: "Banner",
    safe: { inset: inset(62, 0, 63, 0), note: "Cropped to 4:1 on phones" },
    w: 1500,
  },
  { group: "Bluesky", h: 627, id: "bsky-link", label: "Link", w: 1200 },

  // TikTok
  {
    group: "TikTok",
    h: 1920,
    id: "tiktok-video",
    label: "Video / photo post",
    safe: {
      inset: inset(240, 120, 660, 120),
      note: "Caption and buttons (TikTok template)",
    },
    w: 1080,
  },
  profile("TikTok", "tiktok-profile", 400),

  // YouTube
  { group: "YouTube", h: 720, id: "yt-thumb", label: "Thumbnail", w: 1280 },
  {
    group: "YouTube",
    h: 1440,
    id: "yt-banner",
    label: "Channel banner",
    safe: {
      inset: inset(508, 507, 509, 507),
      note: "Shows on every device; desktop shows the full-width band",
    },
    w: 2560,
  },
  {
    group: "YouTube",
    h: 1920,
    id: "yt-short",
    label: "Short",
    safe: {
      inset: inset(192, 108, 480, 0),
      note: "Title and buttons (Google)",
    },
    w: 1080,
  },
  profile("YouTube", "yt-profile", 800),

  // Pinterest
  { group: "Pinterest", h: 1500, id: "pin", label: "Pin", w: 1000 },
  {
    group: "Pinterest",
    h: 1000,
    id: "pin-square",
    label: "Pin · square",
    w: 1000,
  },
  {
    group: "Pinterest",
    h: 450,
    id: "pin-cover",
    label: "Profile cover",
    w: 800,
  },

  // Snapchat
  {
    group: "Snapchat",
    h: 1920,
    id: "snap-story",
    label: "Story / ad",
    w: 1080,
  },

  // Google Business Profile
  {
    group: "Google Business",
    h: 1152,
    id: "gbp-cover",
    label: "Cover",
    w: 2048,
  },
  {
    group: "Google Business",
    h: 900,
    id: "gbp-post",
    label: "Post / update",
    w: 1200,
  },
  {
    group: "Google Business",
    h: 720,
    id: "gbp-logo",
    label: "Logo",
    w: 720,
  },

  // ChatGPT: the Business Hub's own recommendation. Where the logo sits over
  // the cover isn't published yet, so it isn't drawn.
  {
    group: "ChatGPT",
    h: 400,
    id: "chatgpt-cover",
    label: "Business profile cover",
    w: 1200,
  },
  {
    group: "ChatGPT",
    h: 1080,
    id: "chatgpt-ad",
    label: "Ad image · square",
    w: 1080,
  },
];
