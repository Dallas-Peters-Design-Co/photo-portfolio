import type { ImageFit, ShaderLayer } from "./shaderConfig";
import { normalizeLayers, withImage } from "./shaderConfig";
import { activeLayers } from "./shaderStack";

/**
 * A stack as a React component.
 *
 * The canvas already draws a stack as a tree of components from the
 * `shaders/react` package; this writes that same tree out as source, so it
 * runs anywhere the package is installed: an app, a site, a Framer code
 * component. Only the parameters that were changed are written, so the
 * package's own defaults keep applying, as they do on the board.
 */

const INDENT = "  ";
const NOT_WORD = /[^a-zA-Z0-9 ]+/g;
const SPACES = /\s+/u;
const STARTS_WITH_LETTER = /^[A-Za-z]/;

const propValue = (value: unknown): string => {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return `{${JSON.stringify(value)}}`;
};

const propsOf = (layer: ShaderLayer): string =>
  Object.entries(layer.props)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}=${propValue(value)}`)
    .join("");

const jsxOf = (layers: ShaderLayer[], depth: number): string =>
  layers
    .map((layer) => {
      const pad = INDENT.repeat(depth);
      const open = `${layer.name}${propsOf(layer)}`;
      const children = layer.children ?? [];
      if (children.length === 0) {
        return `${pad}<${open} />`;
      }
      return `${pad}<${open}>\n${jsxOf(children, depth + 1)}\n${pad}</${layer.name}>`;
    })
    .join("\n");

const namesIn = (layers: ShaderLayer[], into: Set<string>): Set<string> => {
  for (const layer of layers) {
    into.add(layer.name);
    namesIn(layer.children ?? [], into);
  }
  return into;
};

/** A component name from an item's name or a fallback, in PascalCase. */
const componentName = (name: string | null | undefined): string => {
  const words = (name ?? "")
    .replace(NOT_WORD, " ")
    .split(SPACES)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1));
  const joined = words.join("");
  if (joined === "" || joined === "Shader") {
    // "Shader" is the import; a component can't share its name.
    return "Backdrop";
  }
  return STARTS_WITH_LETTER.test(joined) ? joined : `Backdrop${joined}`;
};

/** The whole file: an import line and a component rendering the stack. */
export const reactSource = (
  layers: ShaderLayer[],
  imageUrl: string | null | undefined,
  name?: string | null,
  fit?: ImageFit
): string => {
  const tree = activeLayers(withImage(normalizeLayers(layers), imageUrl, fit));
  const names = [...namesIn(tree, new Set<string>())].sort();
  const imports = ["Shader", ...names.filter((n) => n !== "Shader")].join(", ");
  return [
    `import { ${imports} } from "shaders/react";`,
    "",
    `export default function ${componentName(name)}() {`,
    "  return (",
    '    <Shader style={{ width: "100%", height: "100%" }}>',
    jsxOf(tree, 3),
    "    </Shader>",
    "  );",
    "}",
    "",
  ].join("\n");
};
