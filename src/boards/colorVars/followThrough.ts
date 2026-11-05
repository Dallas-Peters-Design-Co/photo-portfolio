import type { BoardItem } from "../../types";
import { componentById, rememberComponents } from "../components/store";
import { componentsApi } from "../creative/components/componentsApi";
import { replaceStudioLayer } from "../creative/studioLayer";
import { paletteFor } from "../studio/chosenColors";
import { svgToPngBlob } from "../studio/render";
import { IMAGE_TOOLS } from "../studio/tools";
import { type ImageTool, recipeOf, type StudioRecipe } from "../studio/types";
import { recoloured } from "./colorVars";

/**
 * What a colour change has to reach beyond the board's own items: the
 * components its instances are drawn from, and the pictures the Studio made
 * from recipes that use the colour.
 */

const componentIdsOn = (items: BoardItem[]): string[] => [
  ...new Set(
    items
      .filter((i) => i.kind === "component")
      .map((i) => (i.config as { component?: unknown } | null)?.component)
      .filter((id): id is string => typeof id === "string")
  ),
];

/** Every component placed on the board that uses `from`, saved with `to`. */
export const recolourComponents = async (
  items: BoardItem[],
  from: string,
  to: string
): Promise<number> => {
  const jobs = componentIdsOn(items).flatMap((id) => {
    const def = componentById(id);
    if (!def) {
      return [];
    }
    const was = { layers: def.layers, props: def.props };
    const next = recoloured(was, from, to);
    return next === was
      ? []
      : [
          componentsApi.save({
            height: def.height,
            id: def.id,
            layers: next.layers,
            name: def.name,
            placement: def.placement,
            props: next.props,
            width: def.width,
          }),
        ];
  });
  const saved = await Promise.all(jobs);
  rememberComponents(saved);
  return saved.length;
};

/**
 * The Studio pictures among `ids` made again from their (already changed)
 * recipes. Tools that work from a picture (Mosaic) are left: their source
 * has to be loaded again in the Studio.
 */
export const redrawStudioLayers = async (
  items: BoardItem[],
  ids: string[],
  brandPalette: string[],
  swap: (oldId: string, next: BoardItem) => void
): Promise<number> => {
  const jobs = items
    .filter((i) => ids.includes(i.id))
    .map(async (layer) => {
      const recipe = recipeOf(layer.config);
      const tool = recipe && IMAGE_TOOLS.find((t) => t.id === recipe.tool);
      if (!(recipe && tool) || tool.params.some((p) => p.type === "image")) {
        return 0;
      }
      await redraw(layer, recipe, tool, brandPalette, swap);
      return 1;
    });
  const done = await Promise.all(jobs);
  return done.reduce((a: number, b: number) => a + b, 0);
};

const redraw = async (
  layer: BoardItem,
  recipe: StudioRecipe,
  tool: ImageTool,
  brandPalette: string[],
  swap: (oldId: string, next: BoardItem) => void
) => {
  const { h, w } = recipe.size;
  const svg = tool.render(recipe.values, {
    height: h,
    image: null,
    palette: paletteFor(tool.params, recipe.values, brandPalette),
    width: w,
  });
  const file = tool.vector
    ? new File([svg], `${tool.id}-${w}x${h}.svg`, { type: "image/svg+xml" })
    : new File([await svgToPngBlob(svg, w, h)], `${tool.id}-${w}x${h}.png`, {
        type: "image/png",
      });
  await replaceStudioLayer(file, recipe, layer, swap);
};
