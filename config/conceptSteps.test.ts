import { describe, expect, it } from "vitest";
import { freshConcept, pasteStepsAfter, stepsOf } from "./conceptSteps.js";
import { cleanConcept } from "./reviewConcept.js";

const recommendation = cleanConcept({
  elements: [{ id: "btn", kind: "button", text: "Upload" }],
  steps: [
    {
      caption: "A toast",
      elements: [{ id: "t", kind: "toast", text: "Saved" }],
    },
  ],
  stepTrigger: "btn",
  title: "Upload flow",
});

describe("copying a concept", () => {
  it("gives every element and step new ids, the trigger following its element", () => {
    const copy = freshConcept(recommendation);
    expect(copy.id).not.toBe(recommendation.id);
    expect(copy.elements[0]?.id).not.toBe("btn");
    expect(copy.stepTrigger).toBe(copy.elements[0]?.id);
    expect(copy.steps?.[0]?.elements[0]?.id).not.toBe("t");
    expect(stepsOf(copy)).toHaveLength(2);
  });

  it("pastes a concept's screens as steps after the one being edited", () => {
    const flow = cleanConcept({
      elements: [{ id: "a", kind: "text", text: "Start" }],
      steps: [
        { caption: "End", elements: [{ id: "z", kind: "text", text: "End" }] },
      ],
    });
    const pasted = stepsOf(pasteStepsAfter(flow, 0, recommendation));
    expect(pasted.map((s) => s.caption)).toEqual([
      "",
      "Upload flow",
      "A toast",
      "End",
    ]);
    expect(pasted[1]?.elements[0]?.text).toBe("Upload");
    expect(pasted[1]?.trigger).toBe(pasted[1]?.elements[0]?.id);
  });
});
