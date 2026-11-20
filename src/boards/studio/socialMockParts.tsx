import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type SafeCover, SOCIAL_SIZES } from "../../../config/socialSizes";
import { BrandMark, useSocialBrand } from "./socialBrand";

/**
 * What every social mock-up is built from (SocialPreview.tsx and
 * SocialPreviewMore.tsx): the scaling stage, the picture cropped to the
 * platform's shape with what the platform draws over it, and an avatar.
 */

export interface Spec {
  /** The size whose shape the picture is cropped to. */
  size: string;
  /** The mock-up's width on the platform, in CSS pixels. */
  width: number;
}

export const sizeOf = (id: string) => SOCIAL_SIZES.find((s) => s.id === id);

/** Scales its stage to fit its box, keeping the stage's proportions. */
export function Fit({
  children,
  width,
}: {
  children: ReactNode;
  width: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // A box whose height comes from its content (a node sized to fit, on a
  // published board) has none to fit to: there the mock-up fits the width
  // and the box takes the height it needs. Without this it measured 0 tall
  // and the preview vanished.
  const [height, setHeight] = useState<number | null>(null);
  const sizedByContent = useRef<boolean>(false);
  useLayoutEffect(() => {
    const outer = box.current;
    const inner = stage.current;
    if (!(outer && inner)) {
      return;
    }
    const fit = () => {
      const w = outer.clientWidth;
      const sh = inner.offsetHeight;
      if (!(w > 0 && sh > 0)) {
        return;
      }
      if (!sizedByContent.current && outer.clientHeight < 1) {
        sizedByContent.current = true;
      }
      if (sizedByContent.current) {
        const k = w / width;
        setScale(k);
        setHeight(Math.ceil(sh * k));
        return;
      }
      setScale(Math.min(w / width, outer.clientHeight / sh));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div
      className="social-mock"
      ref={box}
      style={height === null ? undefined : { height }}
    >
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
export function Media({
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
  const aspectRatio = size ? `${size.w} / ${size.h}` : undefined;
  const media = (
    <div
      className="social-mock__media"
      style={{
        aspectRatio: aspectRatio
          ? `var(--social-preview-media-aspect, ${aspectRatio})`
          : undefined,
        borderRadius: radius,
      }}
    >
      {children}
    </div>
  );
  if (!covers) {
    return media;
  }
  // The covers sit in a layer the picture's size but outside its crop: a
  // LinkedIn page logo hangs half below the cover, and inside the crop it
  // was cut in half.
  return (
    <div className="social-mock__media-wrap">
      {media}
      <div className="social-mock__media-covers">{covers}</div>
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

export function Covers({ sizeId }: { sizeId: string }) {
  const covers = sizeOf(sizeId)?.safe?.covers ?? [];
  const { logoUrl } = useSocialBrand();
  return (
    <>
      {covers.map((cover) => (
        <span
          aria-hidden
          className={[
            "social-mock__cover",
            cover.round ? "social-mock__cover--round" : "",
            logoUrl ? "social-mock__logo" : "",
          ].join(" ")}
          key={cover.label}
          style={coverStyle(cover, sizeId)}
        >
          <BrandMark />
        </span>
      ))}
    </>
  );
}

export function Avatar({ size, square }: { size: number; square?: boolean }) {
  const { logoUrl } = useSocialBrand();
  return (
    <span
      aria-hidden
      className={[
        "social-mock__avatar",
        square ? "social-mock__avatar--square" : "",
        logoUrl ? "social-mock__logo" : "",
      ].join(" ")}
      style={{ fontSize: size * 0.42, height: size, width: size }}
    >
      <BrandMark />
    </span>
  );
}
