import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  GUIDE_PLATFORMS,
  type GuidePost,
  postKey,
} from "../../../config/guideSocialPosts.js";
import { pageDesignOf } from "../../../config/pageDesign.js";
import { renderFrameBlob } from "../../boards/io/frameRender";
import { currentFrameRender, frameKeyOf } from "../../boards/io/frameRenderKey";
import { PageDesignView } from "../../boards/pages/PageDesignView";
import { SocialPreview } from "../../boards/studio/SocialPreview";
import {
  SavedSocialBrand,
  socialBrandFor,
} from "../../boards/studio/socialBrand";
import type { BrandKit } from "../../services/brandKitService";
import { boardsApi } from "../../services/portfolioService";
import type { BoardItem } from "../../types";
import "./GuideSocialPosts.css";

function FramePicture({
  frame,
  items,
  boardId,
}: {
  frame: BoardItem;
  items: BoardItem[];
  boardId: string;
}) {
  const stored = currentFrameRender(frame, items);
  const { data: blob, error } = useSWR(
    stored
      ? null
      : ["guide-frame-picture", boardId, frame.id, frameKeyOf(frame, items)],
    () => renderFrameBlob(frame, items),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!blob) {
      setLocal("");
      return;
    }
    const url = URL.createObjectURL(blob);
    setLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const url = stored || local;
  if (url) {
    return (
      <img
        alt={frame.body || "Frame artwork"}
        height={frame.height}
        src={url}
        width={frame.width}
      />
    );
  }
  return (
    <p role="status">
      {error ? "Couldn’t render this frame." : "Loading frame…"}
    </p>
  );
}

function SocialPost({ post }: { post: GuidePost }) {
  const { data: board, error } = useSWR(
    ["guide-social-board", post.boardId],
    () => boardsApi.get(post.boardId)
  );
  const items = board?.items ?? [];
  const frame = items.find((i) => i.id === post.frameId && i.kind === "frame");
  const page = pageDesignOf(frame?.config ?? null);
  const platform = GUIDE_PLATFORMS[post.platform];
  return (
    <figure className="guide-social__post">
      <figcaption className="guide-subhead">
        {platform}
        {frame?.body ? ` · ${frame.body}` : null}
      </figcaption>
      {frame ? (
        <SocialPreview platform={post.platform}>
          {page ? (
            <PageDesignView fitToBounds page={page} />
          ) : (
            <FramePicture boardId={post.boardId} frame={frame} items={items} />
          )}
        </SocialPreview>
      ) : (
        <p role="status">
          {error || board ? "Source frame unavailable." : "Loading frame…"}
        </p>
      )}
    </figure>
  );
}

export function GuideSocialPosts({ kit }: { kit: BrandKit }) {
  return (
    <SavedSocialBrand.Provider value={socialBrandFor(kit)}>
      <div className="guide-social">
        {kit.resolvedDoc.socialPosts.map((post) => (
          <SocialPost key={postKey(post)} post={post} />
        ))}
      </div>
    </SavedSocialBrand.Provider>
  );
}
