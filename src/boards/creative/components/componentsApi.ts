import {
  apiBase,
  jsonHeaders,
  readPageError,
} from "../../../services/portfolioService";
import type { BrandComponent, Draft } from "../../components/model";

/** A brand's components, through api/brand-kits (see _lib/brandComponents.ts). */
export const componentsApi = {
  list: async (kitId: string): Promise<BrandComponent[]> => {
    const res = await fetch(
      `${apiBase()}/api/brand-kits?components=${encodeURIComponent(kitId)}`,
      { headers: jsonHeaders() }
    );
    if (!res.ok) {
      throw new Error(await readPageError(res, "Couldn't load components"));
    }
    return (await res.json()) as BrandComponent[];
  },

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/api/brand-kits`, {
      body: JSON.stringify({ action: "deleteComponent", id }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Couldn't delete it"));
    }
  },

  /** A new component (kitId), or a new version of one (id). */
  save: async (
    draft: Draft & { id?: string; kitId?: string }
  ): Promise<BrandComponent> => {
    const res = await fetch(`${apiBase()}/api/brand-kits`, {
      body: JSON.stringify({ action: "saveComponent", ...draft }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Couldn't save the component"));
    }
    return (await res.json()) as BrandComponent;
  },
};
