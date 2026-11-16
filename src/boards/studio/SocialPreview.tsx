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
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SocialPreviewId } from "../../../config/socialPreview";
import { type SafeCover, SOCIAL_SIZES } from "../../../config/socialSizes";
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

interface Spec {
  /** The size whose shape the picture is cropped to. */
  size: string;
  /** The mock-up's width on the platform, in CSS pixels. */
  width: number;
}

const SPECS: Record<Exclude<SocialPreviewId, "artwork">, Spec> = {
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

const sizeOf = (id: string) => SOCIAL_SIZES.find((s) => s.id === id);

/** Scales its stage to fit its box, keeping the stage's proportions. */
function Fit({ children, width }: { children: ReactNode; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const outer = box.current;
    const inner = stage.current;
    if (!(outer && inner)) {
      return;
    }
    const fit = () => {
      const w = outer.clientWidth;
      const h = outer.clientHeight;
      const sh = inner.offsetHeight;
      if (w > 0 && h > 0 && sh > 0) {
        setScale(Math.min(w / width, h / sh));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div className="social-mock" ref={box}>
      <div
        className="social-mock__stage"
        ref={stage}
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, width }}
      >
        {children}
      </div>
    </div>
  );
}

/** The picture, cropped to the platform's shape. */
function Media({
  children,
  covers,
  radius,
  sizeId,
}: {
  children: ReactNode;
  /** What the platform draws over the picture (a profile photo, a logo). */
  covers?: ReactNode;
  radius?: number;
  sizeId: string;
}) {
  const size = sizeOf(sizeId);
  return (
    <div
      className="social-mock__media"
      style={{
        aspectRatio: size ? `${size.w} / ${size.h}` : undefined,
        borderRadius: radius,
      }}
    >
      {children}
      {covers}
    </div>
  );
}

/** A safe-zone cover drawn where the platform puts it, in the picture's %. */
const coverStyle = (cover: SafeCover, sizeId: string): CSSProperties => {
  const size = sizeOf(sizeId);
  if (!size) {
    return {};
  }
  return {
    height: `${(cover.h / size.h) * 100}%`,
    left: `${(cover.x / size.w) * 100}%`,
    top: `${(cover.y / size.h) * 100}%`,
    width: `${(cover.w / size.w) * 100}%`,
  };
};

function Covers({ initial, sizeId }: { initial: string; sizeId: string }) {
  const covers = sizeOf(sizeId)?.safe?.covers ?? [];
  return (
    <>
      {covers.map((cover) => (
        <span
          aria-hidden
          className={`social-mock__cover${cover.round ? "social-mock__cover--round" : ""}`}
          key={cover.label}
          style={coverStyle(cover, sizeId)}
        >
          {initial}
        </span>
      ))}
    </>
  );
}

const Avatar = ({ size, square }: { size: number; square?: boolean }) => (
  <span
    aria-hidden
    className={`social-mock__avatar${square ? "social-mock__avatar--square" : ""}`}
    style={{ fontSize: size * 0.42, height: size, width: size }}
  >
    Y
  </span>
);

function InstagramPost({ art, spec }: { art: ReactNode; spec: Spec }) {
  return (
    <article className="social-mock__card social-mock__card--ig">
      <header className="social-mock__head">
        <Avatar size={32} />
        <strong>yourbrand</strong>
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
        <strong>yourbrand</strong> Your caption goes here…
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
            <strong>@yourbrand</strong>
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
              <Avatar size={32} /> <strong>yourbrand</strong> 2h
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
  const names = {
    facebook: ["Your Page", "Sponsored · "],
    linkedin: ["Your Company", "12,480 followers · Promoted"],
    x: ["Your Brand", "@yourbrand · 1h"],
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
  const text = {
    facebook: ["Your Page", "12K followers · 240 following", "Follow"],
    "linkedin-banner": [
      "Your Name",
      "Brand designer at Your Company · Austin, Texas",
      "Connect",
    ],
    "linkedin-page": [
      "Your Company",
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
        covers={
          kind === "facebook" ? null : <Covers initial="Y" sizeId={spec.size} />
        }
        sizeId={spec.size}
      >
        {art}
      </Media>
      {kind === "facebook" ? (
        <span aria-hidden className="social-mock__page-photo">
          Y
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
          <small>Your Channel · 12K views · 2 days ago</small>
        </span>
      </footer>
    </article>
  );
}

function Pin({ art, spec }: { art: ReactNode; spec: Spec }) {
  return (
    <article className="social-mock__pin">
      <Media radius={16} sizeId={spec.size}>
        {art}
      </Media>
      <strong>Your pin title</strong>
      <span className="social-mock__pin-who">
        <Avatar size={24} /> Your Board
      </span>
    </article>
  );
}

const mockFor = (
  platform: Exclude<SocialPreviewId, "artwork">,
  art: ReactNode
): ReactNode => {
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
  platform,
}: {
  children: ReactNode;
  platform: SocialPreviewId;
}) {
  if (platform === "artwork") {
    return children;
  }
  return (
    <section
      aria-label={`${platform} preview`}
      className="studio-social-preview"
    >
      <Fit width={SPECS[platform].width}>{mockFor(platform, children)}</Fit>
    </section>
  );
}
