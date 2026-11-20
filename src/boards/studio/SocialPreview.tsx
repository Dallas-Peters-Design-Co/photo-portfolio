import {
  Bookmark,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Repeat2,
  Send,
  Share,
  ThumbsUp,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { SocialPreviewId } from "../../../config/socialPreview";
import { isMorePreview, MORE_SPECS, moreMockFor } from "./SocialPreviewMore";
import { BrandMark, useSocialBrand } from "./socialBrand";
import { Avatar, Covers, Fit, Media, type Spec } from "./socialMockParts";
import "./SocialPreview.css";

/**
 * A wired picture shown as it would appear on a platform.
 *
 * Each mock-up is drawn at the platform's own on-screen size (an Instagram
 * post is 470px wide, a LinkedIn profile card 804px) and the whole of it is
 * scaled to fit its box, so the chrome keeps its proportions to the picture
 * at any size — a node made bigger shows a bigger post, not a bigger box
 * round a small one.
 *
 * The picture area is the platform's crop, from the same sizes the frames
 * use (config/socialSizes.ts), and on page and profile banners the photo or
 * logo sits where those sizes' measured safe zones say it covers.
 */

const SPECS: Record<Exclude<SocialPreviewId, "artwork">, Spec> = {
  ...MORE_SPECS,
  "facebook-cover": { size: "fb-cover", width: 940 },
  "facebook-post": { size: "fb-portrait", width: 500 },
  "instagram-post": { size: "ig-portrait", width: 470 },
  "instagram-story": { size: "ig-story", width: 360 },
  "linkedin-banner": { size: "li-banner", width: 804 },
  "linkedin-page": { size: "li-company-cover", width: 1128 },
  "linkedin-post": { size: "li-post", width: 555 },
  "pinterest-pin": { size: "pin", width: 300 },
  "tiktok-post": { size: "tiktok-video", width: 360 },
  "x-post": { size: "x-post", width: 598 },
  "youtube-video": { size: "yt-thumb", width: 400 },
};

function InstagramPost({ art, spec }: { art: ReactNode; spec: Spec }) {
  const { handle } = useSocialBrand();
  return (
    <article className="social-mock__card social-mock__card--ig">
      <header className="social-mock__head">
        <Avatar size={32} />
        <strong>{handle}</strong>
        <MoreHorizontal className="social-mock__end" size={20} />
      </header>
      <Media sizeId={spec.size}>{art}</Media>
      <div className="social-mock__icons">
        <Heart size={24} />
        <MessageCircle size={24} />
        <Send size={24} />
        <Bookmark className="social-mock__end" size={24} />
      </div>
      <p className="social-mock__line">
        <strong>1,024 likes</strong>
      </p>
      <p className="social-mock__line">
        <strong>{handle}</strong> Your caption goes here…
      </p>
      <p className="social-mock__line social-mock__muted">2 hours ago</p>
    </article>
  );
}

function Vertical({
  art,
  spec,
  tiktok,
}: {
  art: ReactNode;
  spec: Spec;
  tiktok: boolean;
}) {
  const { handle } = useSocialBrand();
  return (
    <article className="social-mock__vertical">
      <Media radius={tiktok ? 0 : 12} sizeId={spec.size}>
        {art}
      </Media>
      {tiktok ? (
        <>
          <div className="social-mock__side">
            <Avatar size={44} />
            <Heart size={30} />
            <MessageCircle size={30} />
            <Bookmark size={30} />
            <Share size={30} />
          </div>
          <footer className="social-mock__over social-mock__over--bottom">
            <strong>@{handle}</strong>
            <span>Your caption goes here… #hashtag</span>
            <span>
              <Music2 size={14} /> Original sound
            </span>
          </footer>
        </>
      ) : (
        <>
          <div className="social-mock__over social-mock__over--top">
            <span className="social-mock__progress" />
            <span className="social-mock__story-who">
              <Avatar size={32} /> <strong>{handle}</strong> 2h
            </span>
          </div>
          <footer className="social-mock__over social-mock__over--bottom social-mock__reply">
            <span>Send message</span>
            <Heart size={26} />
            <Send size={26} />
          </footer>
        </>
      )}
    </article>
  );
}

function FeedPost({
  art,
  platform,
  spec,
}: {
  art: ReactNode;
  platform: "facebook" | "linkedin" | "x";
  spec: Spec;
}) {
  const brand = useSocialBrand();
  const names = {
    facebook: [brand.name, "Sponsored · "],
    linkedin: [brand.name, "12,480 followers · Promoted"],
    x: [brand.name, `@${brand.handle} · 1h`],
  } as const;
  const [name, meta] = names[platform];
  const actions = {
    facebook: [
      [ThumbsUp, "Like"],
      [MessageCircle, "Comment"],
      [Share, "Share"],
    ],
    linkedin: [
      [ThumbsUp, "Like"],
      [MessageCircle, "Comment"],
      [Repeat2, "Repost"],
      [Send, "Send"],
    ],
    x: [
      [MessageCircle, "24"],
      [Repeat2, "12"],
      [Heart, "248"],
      [Share, ""],
    ],
  } as const;
  return (
    <article className={`social-mock__card social-mock__card--${platform}`}>
      <header className="social-mock__head">
        <Avatar
          size={platform === "linkedin" ? 48 : 40}
          square={platform === "linkedin"}
        />
        <span className="social-mock__who">
          <strong>{name}</strong>
          <small>
            {meta}
            {platform === "facebook" ? <Globe size={12} /> : null}
          </small>
        </span>
        <MoreHorizontal className="social-mock__end" size={20} />
      </header>
      <p className="social-mock__text">Your post text goes here…</p>
      <Media radius={platform === "x" ? 16 : 0} sizeId={spec.size}>
        {art}
      </Media>
      <footer className="social-mock__actions">
        {actions[platform].map(([Icon, label]) => (
          <span key={`${label}-${Icon.displayName}`}>
            <Icon size={18} /> {label}
          </span>
        ))}
      </footer>
    </article>
  );
}

function PageHeader({
  art,
  kind,
  spec,
}: {
  art: ReactNode;
  kind: "facebook" | "linkedin-banner" | "linkedin-page";
  spec: Spec;
}) {
  const brand = useSocialBrand();
  const text = {
    facebook: [brand.name, "12K followers · 240 following", "Follow"],
    "linkedin-banner": [
      "Your Name",
      `Designer at ${brand.name} · Austin, Texas`,
      "Connect",
    ],
    "linkedin-page": [
      brand.name,
      "Design services · Austin, Texas · 12,480 followers",
      "+ Follow",
    ],
  } as const;
  const [name, meta, button] = text[kind];
  return (
    <article
      className={`social-mock__card social-mock__page social-mock__page--${kind}`}
    >
      <Media
        covers={kind === "facebook" ? null : <Covers sizeId={spec.size} />}
        sizeId={spec.size}
      >
        {art}
      </Media>
      {kind === "facebook" ? (
        <span
          aria-hidden
          className={[
            "social-mock__page-photo",
            brand.logoUrl ? "social-mock__logo" : "",
          ].join(" ")}
        >
          <BrandMark />
        </span>
      ) : null}
      <div className="social-mock__page-body">
        <strong className="social-mock__page-name">{name}</strong>
        <span className="social-mock__muted">{meta}</span>
        <span className="social-mock__buttons">
          <span className="social-mock__button">{button}</span>
          <span className="social-mock__button social-mock__button--quiet">
            Message
          </span>
        </span>
      </div>
      {kind === "linkedin-page" ? (
        <nav className="social-mock__tabs">
          <span>Home</span>
          <span>About</span>
          <span>Posts</span>
          <span>Jobs</span>
          <span>People</span>
        </nav>
      ) : null}
    </article>
  );
}

function YouTube({ art, spec }: { art: ReactNode; spec: Spec }) {
  const { name } = useSocialBrand();
  return (
    <article className="social-mock__video">
      <Media radius={12} sizeId={spec.size}>
        {art}
        <span className="social-mock__duration">12:34</span>
        <Play className="social-mock__play" size={48} />
      </Media>
      <footer className="social-mock__video-meta">
        <Avatar size={36} />
        <span>
          <strong>Your video title goes here</strong>
          <small>{name} · 12K views · 2 days ago</small>
        </span>
      </footer>
    </article>
  );
}

function Pin({ art, spec }: { art: ReactNode; spec: Spec }) {
  const { name } = useSocialBrand();
  return (
    <article className="social-mock__pin">
      <Media radius={16} sizeId={spec.size}>
        {art}
      </Media>
      <strong>Your pin title</strong>
      <span className="social-mock__pin-who">
        <Avatar size={24} /> {name}
      </span>
    </article>
  );
}

const mockFor = (
  platform: Exclude<SocialPreviewId, "artwork">,
  art: ReactNode
): ReactNode => {
  if (isMorePreview(platform)) {
    return moreMockFor(platform, art);
  }
  const spec = SPECS[platform];
  switch (platform) {
    case "instagram-post":
      return <InstagramPost art={art} spec={spec} />;
    case "instagram-story":
    case "tiktok-post":
      return (
        <Vertical art={art} spec={spec} tiktok={platform === "tiktok-post"} />
      );
    case "facebook-cover":
      return <PageHeader art={art} kind="facebook" spec={spec} />;
    case "linkedin-page":
    case "linkedin-banner":
      return <PageHeader art={art} kind={platform} spec={spec} />;
    case "youtube-video":
      return <YouTube art={art} spec={spec} />;
    case "pinterest-pin":
      return <Pin art={art} spec={spec} />;
    case "linkedin-post":
      return <FeedPost art={art} platform="linkedin" spec={spec} />;
    case "x-post":
      return <FeedPost art={art} platform="x" spec={spec} />;
    default:
      return <FeedPost art={art} platform="facebook" spec={spec} />;
  }
};

export function SocialPreview({
  children,
  mediaAspectRatio,
  platform,
}: {
  children: ReactNode;
  /** Preserve the live artwork's full frame ratio in a feed post. */
  mediaAspectRatio?: number;
  platform: SocialPreviewId;
}) {
  if (platform === "artwork") {
    return children;
  }
  return (
    <section
      aria-label={`${platform} preview`}
      className="studio-social-preview"
      style={
        mediaAspectRatio
          ? ({
              "--social-preview-media-aspect": String(mediaAspectRatio),
            } as CSSProperties)
          : undefined
      }
    >
      <Fit width={SPECS[platform].width}>{mockFor(platform, children)}</Fit>
    </section>
  );
}
