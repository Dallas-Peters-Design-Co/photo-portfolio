import { X } from "lucide-react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { KitShaderPreview } from "../../boards/brand/KitShaderPreview";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import "./BrandKitShaders.css";

/**
 * The kit's shaders (config/kitShaders.ts), each drawn live with its name
 * to change and a remove. They are made on a board: pick this brand in the
 * board's Brand panel, select a shader, and press Brand in its panel.
 * A sub-brand with none of its own shows its parent's, read-only.
 */
export function BrandKitShaders({
  doc,
  effective,
  onChange,
}: {
  doc: BrandKitDoc;
  effective: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const own = doc.shaders;
  const shown = own.length > 0 ? own : effective.shaders;
  const inherited = own.length === 0 && shown.length > 0;
  if (shown.length === 0) {
    return (
      <p className="brand-kit__hint">
        No shaders yet. On a board, pick this brand in the Brand panel, select a
        shader and press Brand in its settings to keep it here.
      </p>
    );
  }
  return (
    <div className="stack stack--snug">
      {inherited ? (
        <p className="brand-kit__hint">
          From the parent brand. Save a shader to this brand to start its own.
        </p>
      ) : null}
      <ul className="brand-kit-shaders">
        {shown.map((shader) => (
          <li className="brand-kit-shaders__item" key={shader.id}>
            <span className="brand-kit-shaders__preview">
              <KitShaderPreview shader={shader} />
            </span>
            <div className="brand-kit-shaders__row">
              <Input
                aria-label="Shader name"
                disabled={inherited}
                onChange={(e) =>
                  onChange({
                    ...doc,
                    shaders: own.map((s) =>
                      s.id === shader.id ? { ...s, name: e.target.value } : s
                    ),
                  })
                }
                size="sm"
                value={shader.name}
              />
              {inherited ? null : (
                <Button
                  aria-label={`Remove ${shader.name}`}
                  onClick={() =>
                    onChange({
                      ...doc,
                      shaders: own.filter((s) => s.id !== shader.id),
                    })
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X size={14} />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
