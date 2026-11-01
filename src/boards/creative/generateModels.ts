import { useState } from "react";
import type { AiModel } from "../../types";
import { useModels } from "../ModelsContext";

/**
 * The models the frame editor's Generate can use: the enabled image models
 * that make a picture from words (with or without a photo to work from), in
 * the admin's order. The choice is remembered per browser.
 */

const KEY = "creative-generate:model";
/** The text-to-image model the automatic choice uses when no photo is sent. */
export const PREFERRED = "fal-ai/nano-banana-pro";

const AUTO = {
  id: "auto",
  input: "prompt-or-image",
  label: "Auto (Nano Banana Edit with photos)",
} as const;

type Choice = Pick<AiModel, "id" | "input" | "label">;

export const generateChoices = (models: AiModel[]): Choice[] => [
  AUTO,
  ...models.filter(
    (m) =>
      m.id !== "auto" &&
      m.output === "image" &&
      (m.training === null || m.training.status === "ready") &&
      ["prompt", "prompt-or-image", "prompt-and-image"].includes(m.input)
  ),
];

const remembered = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const useGenerateModel = () => {
  const { models } = useModels();
  const choices = generateChoices(models);
  const [picked, setPicked] = useState<string | null>(remembered);
  const has = (id: string | null) => choices.some((c) => c.id === id);
  let model = "auto";
  if (has(picked)) {
    model = picked ?? "auto";
  } else if (has(PREFERRED)) {
    model = PREFERRED;
  }
  const setModel = (id: string) => {
    setPicked(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Remembering is a convenience.
    }
  };
  const input = choices.find((c) => c.id === model)?.input;
  return { choices, model, setModel, takesPhotos: input !== "prompt" };
};
