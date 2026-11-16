import type { NodeType } from "../nodeTypes.js";

/** A canvas mockup that presents a wired image in a social platform shell. */
export const SOCIAL: NodeType = {
  id: "social",
  inputs: [
    {
      arity: "one",
      key: "image",
      label: "Frame artwork",
      required: true,
      type: "image",
    },
  ],
  label: "Social Preview",
  outputs: [],
  settings: [
    {
      default: "facebook-post",
      key: "platform",
      kind: "select",
      label: "Platform",
      optionLabels: {
        "facebook-cover": "Facebook · Page cover",
        "facebook-post": "Facebook · Post",
        "instagram-post": "Instagram · Post",
        "instagram-story": "Instagram · Story / Reel",
        "linkedin-banner": "LinkedIn · Profile banner",
        "linkedin-page": "LinkedIn · Company page cover",
        "linkedin-post": "LinkedIn · Post",
        "pinterest-pin": "Pinterest · Pin",
        "tiktok-post": "TikTok · Video / photo post",
        "x-post": "X · Post",
        "youtube-video": "YouTube · Video thumbnail",
      },
      options: [
        "instagram-post",
        "instagram-story",
        "facebook-post",
        "facebook-cover",
        "tiktok-post",
        "linkedin-post",
        "linkedin-page",
        "linkedin-banner",
        "x-post",
        "pinterest-pin",
        "youtube-video",
      ],
    },
  ],
};
