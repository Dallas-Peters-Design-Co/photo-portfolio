import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import {
  GUIDE_PLATFORMS,
  type GuidePlatform,
  postKey,
} from "../../../config/guideSocialPosts.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { brandKitsApi } from "../../services/brandKitService";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "./ActiveBrand";

export function FrameSocialPosts({ item }: { item: BoardItem }) {
  const kit = useActiveBrand()?.kit;
  const { boardId } = useParams<{ boardId: string }>();
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  if (item.kind !== "frame" || !(kit && boardId)) {
    return null;
  }
  const frameId = item.id;
  const posts = kit.doc.socialPosts;
  const options = Object.entries(GUIDE_PLATFORMS).map(([platform, label]) => {
    const selected = posts.some(
      (p) =>
        p.frameId === frameId &&
        p.boardId === boardId &&
        p.platform === platform
    );
    return {
      label: selected ? `Remove ${label} post` : `Add ${label} post`,
      selected,
      value: platform,
    };
  });
  const change = async (platform: GuidePlatform, remove: boolean) => {
    setBusy(true);
    try {
      const fresh = await brandKitsApi.get(kit.id);
      const post = { boardId, frameId, platform };
      const key = postKey(post);
      const rest = fresh.doc.socialPosts.filter((p) => postKey(p) !== key);
      const saved = await brandKitsApi.save(kit.id, {
        ...fresh.doc,
        socialPosts: remove ? rest : [...rest, post],
      });
      await mutate(["kit", kit.id], saved, { revalidate: false });
      await mutate((k) => Array.isArray(k) && k[0] === "brand-kits");
      toast.success(
        `${GUIDE_PLATFORMS[platform]} post ${remove ? "removed from" : "added to"} ${kit.name}’s brand guide`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't update the brand guide."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Select
      disabled={busy}
      onValueChange={(value) => {
        const option = options.find((o) => o.value === value);
        if (option) {
          void change(option.value as GuidePlatform, option.selected);
        }
      }}
      value={null}
    >
      <SelectTrigger
        aria-label="Brand guide social posts"
        size="sm"
        tone="board"
      >
        <SelectValue placeholder="Social post" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
