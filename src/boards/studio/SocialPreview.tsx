import type { ReactNode } from "react";
import "./SocialPreview.css";

export const SOCIAL_PREVIEW_OPTIONS = [
  { group: "Instagram", id: "instagram-post", label: "Post" },
  { group: "Instagram", id: "instagram-story", label: "Story / Reel" },
  { group: "Facebook", id: "facebook-post", label: "Post" },
  { group: "Facebook", id: "facebook-cover", label: "Page cover" },
  { group: "TikTok", id: "tiktok-post", label: "Video / photo post" },
  { group: "LinkedIn", id: "linkedin-post", label: "Post" },
  { group: "LinkedIn", id: "linkedin-page", label: "Company page" },
  { group: "X", id: "x-post", label: "Post" },
  { group: "Pinterest", id: "pinterest-pin", label: "Pin" },
  { group: "YouTube", id: "youtube-video", label: "Video thumbnail" },
] as const;

export type SocialPreviewId =
  | (typeof SOCIAL_PREVIEW_OPTIONS)[number]["id"]
  | "artwork";

export function SocialPreview({
  children,
  platform,
}: {
  children: ReactNode;
  platform: SocialPreviewId;
}) {
  if (platform === "artwork") {
    return children;
  }

  const art = <div className="studio-social-preview__art">{children}</div>;

  if (platform === "instagram-post") {
    return (
      <section
        aria-label="Instagram post preview"
        className="studio-social-preview"
      >
        <article className="studio-social-preview__post studio-social-preview__post--instagram">
          <header className="studio-social-preview__header">
            <span className="studio-social-preview__avatar">Y</span>
            <strong>yourbrand</strong>
            <span className="studio-social-preview__more">•••</span>
          </header>
          {art}
          <footer className="studio-social-preview__footer">
            <span className="studio-social-preview__actions">♡　◯　↗</span>
            <span>♡　24 likes</span>
            <span className="studio-social-preview__muted">
              yourbrand Your caption goes here…
            </span>
          </footer>
        </article>
      </section>
    );
  }

  if (platform === "instagram-story" || platform === "tiktok-post") {
    const isTikTok = platform === "tiktok-post";
    return (
      <section
        aria-label={`${isTikTok ? "TikTok" : "Instagram story"} preview`}
        className="studio-social-preview"
      >
        <article
          className={`studio-social-preview__vertical ${isTikTok ? "studio-social-preview__vertical--tiktok" : "studio-social-preview__vertical--story"}`}
        >
          {art}
          <header className="studio-social-preview__vertical-head">
            <span>◉</span> yourbrand
          </header>
          {isTikTok ? (
            <>
              <div className="studio-social-preview__vertical-actions">
                ♡<br />◯<br />↗
              </div>
              <footer className="studio-social-preview__vertical-foot">
                <strong>@yourbrand</strong>
                <span>Your caption goes here…</span>
                <span>♫ Original sound</span>
              </footer>
            </>
          ) : (
            <span className="studio-social-preview__story-reply">
              Send message
            </span>
          )}
        </article>
      </section>
    );
  }

  if (platform === "facebook-cover") {
    return (
      <section
        aria-label="Facebook page cover preview"
        className="studio-social-preview"
      >
        <article className="studio-social-preview__page studio-social-preview__page--facebook">
          {art}
          <div className="studio-social-preview__page-info">
            <span className="studio-social-preview__page-avatar">Y</span>
            <div>
              <strong>Your Page</strong>
              <span>Page · 12K followers</span>
            </div>
            <span className="studio-social-preview__page-button">Follow</span>
          </div>
          <nav className="studio-social-preview__page-nav">
            Posts　About　Photos　More
          </nav>
        </article>
      </section>
    );
  }

  if (platform === "linkedin-page") {
    return (
      <section
        aria-label="LinkedIn company page preview"
        className="studio-social-preview"
      >
        <article className="studio-social-preview__page studio-social-preview__page--linkedin">
          {art}
          <div className="studio-social-preview__page-info">
            <span className="studio-social-preview__company-logo">Y</span>
            <div>
              <strong>Your Company</strong>
              <span>Design · 1,200 followers</span>
            </div>
            <span className="studio-social-preview__page-button">
              ＋ Follow
            </span>
          </div>
          <nav className="studio-social-preview__page-nav">
            Home　About　Posts　Jobs
          </nav>
        </article>
      </section>
    );
  }

  if (platform === "youtube-video") {
    return (
      <section
        aria-label="YouTube video thumbnail preview"
        className="studio-social-preview"
      >
        <article className="studio-social-preview__video">
          {art}
          <span className="studio-social-preview__play">▶</span>
          <footer>
            <span className="studio-social-preview__channel">Y</span>
            <span>
              <strong>Your video title</strong>
              <small>Your Channel · 12K views</small>
            </span>
          </footer>
        </article>
      </section>
    );
  }

  if (platform === "pinterest-pin") {
    return (
      <section
        aria-label="Pinterest pin preview"
        className="studio-social-preview"
      >
        <article className="studio-social-preview__pin">
          {art}
          <footer>
            <strong>Your pin title</strong>
            <span>Your Board</span>
          </footer>
        </article>
      </section>
    );
  }

  const isLinkedIn = platform === "linkedin-post";
  const isX = platform === "x-post";
  let postPlatform = "facebook";
  let platformName = "Facebook";
  let authorName = "Your Page";
  let authorMeta = "Sponsored · 1h";
  if (isLinkedIn) {
    postPlatform = "linkedin";
    platformName = "LinkedIn";
    authorName = "Your Name";
    authorMeta = "Company · 1h";
  } else if (isX) {
    postPlatform = "x";
    platformName = "X";
    authorName = "Your Brand";
  }
  return (
    <section
      aria-label={`${platformName} post preview`}
      className="studio-social-preview"
    >
      <article
        className={`studio-social-preview__post studio-social-preview__post--${postPlatform}`}
      >
        <header className="studio-social-preview__header">
          <span className="studio-social-preview__avatar">Y</span>
          <span>
            <strong>{authorName}</strong>
            <small>{authorMeta}</small>
          </span>
          <span className="studio-social-preview__more">•••</span>
        </header>
        <p className="studio-social-preview__copy">Your post text goes here…</p>
        {art}
        <footer className="studio-social-preview__post-actions">
          <span>♡　Like</span>
          <span>◯　Comment</span>
          <span>↗　Share</span>
        </footer>
      </article>
    </section>
  );
}
