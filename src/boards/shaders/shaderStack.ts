import type { ShaderLayer } from "./shaderConfig";
import { isEffect } from "./shaderConfig";

/**
 * The stack as a list, when it is one.
 *
 * The saved shape is a tree, because an effect has to say what it covers. But
 * nearly every stack anyone builds is a single chain — effect over effect over
 * one source — and a chain reads far better as a list: the source at the
 * bottom, each effect a row above it, a switch on each. This file is the two
 * readings of the same data.
 */

export interface Chain {
  /** Outermost first: the top row is applied last and seen first. */
  effects: ShaderLayer[];
  /** What the effects work on; null when a wired picture supplies it. */
  source: ShaderLayer | null;
}

/**
 * The tree as a chain, or null where it branches.
 *
 * A level with two layers, or an effect holding more than one thing, is not a
 * chain (that is what Group is for) and keeps the tree view.
 */
export const chainOf = (layers: ShaderLayer[]): Chain | null => {
  const effects: ShaderLayer[] = [];
  let level = layers;
  for (;;) {
    if (level.length === 0) {
      return { effects, source: null };
    }
    const [only] = level;
    if (level.length > 1 || !only) {
      return null;
    }
    if (!isEffect(only.name)) {
      return { effects, source: only };
    }
    effects.push(only);
    level = only.children ?? [];
  }
};

/** The chain back as a tree, each effect holding the next. */
export const layersOfChain = ({ effects, source }: Chain): ShaderLayer[] => {
  let inner: ShaderLayer[] = source ? [source] : [];
  for (const effect of [...effects].reverse()) {
    inner = [{ ...effect, children: inner }];
  }
  return inner;
};

/** The layers that draw: effects switched off are unwrapped, sources dropped. */
export const activeLayers = (layers: ShaderLayer[]): ShaderLayer[] =>
  layers.flatMap((layer) => {
    const children = activeLayers(layer.children ?? []);
    if (layer.enabled === false) {
      return isEffect(layer.name) ? children : [];
    }
    return [layer.children ? { ...layer, children } : layer];
  });

/** `list` with the item at `from` moved to `to`. */
export const moved = <T>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(Math.max(0, Math.min(list.length - 1, to)), 0, item);
  }
  return next;
};
