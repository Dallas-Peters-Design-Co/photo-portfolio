import {
  CalendarDays,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share,
  Star,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSocialBrand } from "./socialBrand";
import { Avatar, Media, type Spec } from "./socialMockParts";
import "./SocialPreviewMore.css";

/**
 * Mock-ups for Facebook events, Google Business Profile and ChatGPT, each at
 * the platform's on-screen size with its picture in the crop the frame sizes
 * use (config/socialSizes.ts).
 *
 * ChatGPT hasn't published how its business profiles and ads are laid out,
 * so those two are drawn from what has been shown publicly and its usual
 * look; check them against the real thing before a launch.
 */

export const MORE_SPECS = {
  "chatgpt-ad": { size: "chatgpt-ad", width: 640 },
  "chatgpt-profile": { size: "chatgpt-cover", width: 760 },
  "facebook-event": { size: "fb-event-cover", width: 680 },
  "google-business-post": { size: "gbp-post", width: 420 },
  "google-business-profile": { size: "gbp-cover", width: 408 },
} satisfies Record<string, Spec>;

export type MorePreviewId = keyof typeof MORE_SPECS;

export const isMorePreview = (id: string): id is MorePreviewId =>
  id in MORE_SPECS;

function FacebookEvent({ art, spec }: { art: ReactNode; spec: Spec }) {
  const brand = useSocialBrand();
  return (
    <article className="social-mock__card social-mock__event">
      <Media radius={8} sizeId={spec.size}>
        {art}
      </Media>
      <div className="social-mock__event-body">
        <span className="social-mock__event-date">
          <small>NOV</small>
          <strong>21</strong>
        </span>
        <div className="social-mock__who">
          <small className="social-mock__event-when">
            FRIDAY, NOVEMBER 21, 2026 AT 7 PM
          </small>
          <strong className="social-mock__page-name">Your event name</strong>
          <small>Hosted by {brand.name} · Austin, Texas</small>
        </div>
      </div>
      <div className="social-mock__buttons social-mock__event-buttons">
        <span className="social-mock__button">★ Interested</span>
        <span className="social-mock__button social-mock__button--quiet">
          ✓ Going
        </span>
        <span className="social-mock__button social-mock__button--quiet">
          <Share size={14} /> Invite
        </span>
      </div>
    </article>
  );
}

function GoogleProfile({ art, spec }: { art: ReactNode; spec: Spec }) {
  const brand = useSocialBrand();
  return (
    <article className="social-mock__card social-mock__gbp">
      <Media sizeId={spec.size}>{art}</Media>
      <div className="social-mock__gbp-body">
        <strong className="social-mock__gbp-name">{brand.name}</strong>
        <span className="social-mock__gbp-rating">
          4.8{" "}
          {[1, 2, 3, 4, 5].map((n) => (
            <Star fill="#fbbc04" key={n} size={13} stroke="#fbbc04" />
          ))}{" "}
          <span className="social-mock__muted">(126)</span>
        </span>
        <span className="social-mock__muted">Design studio · Austin</span>
        <span className="social-mock__gbp-open">
          Open <span className="social-mock__muted">· Closes 6 PM</span>
        </span>
      </div>
      <div className="social-mock__gbp-actions">
        {(
          [
            [Navigation, "Directions"],
            [Phone, "Call"],
            [Globe, "Website"],
            [Share, "Share"],
          ] as const
        ).map(([Icon, label]) => (
          <span key={label}>
            <span className="social-mock__gbp-icon">
              <Icon size={18} />
            </span>
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function GooglePost({ art, spec }: { art: ReactNode; spec: Spec }) {
  const brand = useSocialBrand();
  return (
    <article className="social-mock__card social-mock__gbp-post">
      <header className="social-mock__head">
        <Avatar size={36} />
        <span className="social-mock__who">
          <strong>{brand.name}</strong>
          <small>2 days ago</small>
        </span>
      </header>
      <Media sizeId={spec.size}>{art}</Media>
      <p className="social-mock__text social-mock__gbp-copy">
        Your update goes here: an offer, an event or news.
      </p>
      <span className="social-mock__gbp-cta">Learn more</span>
    </article>
  );
}

function ChatGptProfile({ art, spec }: { art: ReactNode; spec: Spec }) {
  const brand = useSocialBrand();
  return (
    <article className="social-mock__chatgpt">
      <Media radius={16} sizeId={spec.size}>
        {art}
      </Media>
      <div className="social-mock__chatgpt-who">
        <Avatar size={56} />
        <div className="social-mock__who">
          <strong className="social-mock__page-name">{brand.name}</strong>
          <small>Design services · {brand.site}</small>
        </div>
        <span className="social-mock__chatgpt-button">
          <MessageCircle size={14} /> Ask about us
        </span>
      </div>
      <p className="social-mock__chatgpt-about">
        A line about what you do and who it's for.
      </p>
    </article>
  );
}

function ChatGptAd({ art, spec }: { art: ReactNode; spec: Spec }) {
  const brand = useSocialBrand();
  return (
    <article className="social-mock__chatgpt social-mock__chatgpt-chat">
      <p className="social-mock__chatgpt-answer">
        Here are a few studios that could help with a brand refresh…
      </p>
      <div className="social-mock__chatgpt-ad">
        <div className="social-mock__chatgpt-ad-art">
          <Media radius={12} sizeId={spec.size}>
            {art}
          </Media>
        </div>
        <div className="social-mock__who">
          <small className="social-mock__muted">Sponsored</small>
          <strong>{brand.name}</strong>
          <small>One line on why to choose you.</small>
          <span className="social-mock__chatgpt-link">
            <MapPin size={12} /> {brand.site}
          </span>
        </div>
      </div>
      <span className="social-mock__chatgpt-input">
        <CalendarDays size={14} /> Ask anything
      </span>
    </article>
  );
}

export const moreMockFor = (
  platform: MorePreviewId,
  art: ReactNode
): ReactNode => {
  const spec = MORE_SPECS[platform];
  switch (platform) {
    case "facebook-event":
      return <FacebookEvent art={art} spec={spec} />;
    case "google-business-profile":
      return <GoogleProfile art={art} spec={spec} />;
    case "google-business-post":
      return <GooglePost art={art} spec={spec} />;
    case "chatgpt-profile":
      return <ChatGptProfile art={art} spec={spec} />;
    default:
      return <ChatGptAd art={art} spec={spec} />;
  }
};
