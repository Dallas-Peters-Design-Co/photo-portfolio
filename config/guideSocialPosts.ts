export const GUIDE_PLATFORMS = {
  "facebook-post": "Facebook",
  "linkedin-post": "LinkedIn",
  "x-post": "X (Twitter)",
} as const;

export type GuidePlatform = keyof typeof GUIDE_PLATFORMS;
export interface GuidePost {
  boardId: string;
  frameId: string;
  platform: GuidePlatform;
}

const ID = /^[\w-]{1,100}$/;
export const postKey = (post: GuidePost) =>
  [post.boardId, post.frameId, post.platform].join(":");

export function cleanGuidePosts(value: unknown): GuidePost[] {
  const posts = new Map<string, GuidePost>();
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { boardId, frameId, platform } = item;
    if (
      typeof boardId !== "string" ||
      !ID.test(boardId) ||
      typeof frameId !== "string" ||
      !ID.test(frameId) ||
      typeof platform !== "string" ||
      !Object.hasOwn(GUIDE_PLATFORMS, platform)
    ) {
      continue;
    }
    const post = { boardId, frameId, platform: platform as GuidePlatform };
    posts.set(postKey(post), post);
  }
  return [...posts.values()];
}
