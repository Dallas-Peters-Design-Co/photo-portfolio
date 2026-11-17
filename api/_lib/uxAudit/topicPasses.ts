import { describeStyles } from "../../../config/pageStyles.js";
import type { ReviewScreen } from "../../../config/review.js";
import {
  type BriefCoverage,
  cleanCoverage,
} from "../../../config/reviewBrief.js";
import {
  AUDIT_TOPICS,
  type AuditTopic,
  type AuditTopicKey,
  cleanAuditTopic,
} from "../../../config/reviewTopics.js";
import {
  askClaude,
  type Block,
  sourcesFromScreens,
  tileContent,
} from "./audit.js";
import { COVERAGE_INSTRUCTIONS } from "./briefPrompt.js";
import { colourBlindTiles } from "./colourBlind.js";
import { tileEachScreen } from "./tiles.js";

/**
 * The deep audit's topic passes (config/reviewTopics.ts): one call per
 * topic, each across every screen, held to the review's brief. Run as
 * separate requests beside the main audit, so the slowest stays inside one
 * function's time.
 *
 * The accessibility pass also sees the screens as people with colour-
 * blindness do (colourBlind.ts); colour, type and the developer rules also
 * read each screen's measured styles (config/pageStyles.ts), so the values
 * they name are the app's own.
 */

const TOPIC_OUTPUT_TOKENS = 24_000;
const COVERAGE_OUTPUT_TOKENS = 12_000;

const FOCUS: Record<AuditTopicKey, string> = {
  accessibility:
    "Accessibility, WCAG 2.2 AA: contrast of text and controls (name the colours and the ratio you estimate), focus visibility, target sizes, labels, and above all whether meaning is carried by colour alone. The re-coloured pictures after the screens show the top of key screens as people with protanopia, deuteranopia and tritanopia see them: say exactly what merges or disappears for each (status pills, links, charts, errors, selected states) and what to add (a label, icon, pattern or weight) so it survives.",
  colour:
    "Colour: the palette in use, how consistently each colour carries one meaning (action, status, selection, emphasis), contrast between text and its ground, accent spend, and where colour fights the content. Name the actual values from the measured styles when given.",
  hierarchy:
    "Visual hierarchy and layout: what the eye reads first on each screen and whether that is what matters, grouping, alignment, spacing rhythm, density, and consistency of page structure across screens.",
  interactions:
    "Interactions and states: buttons, links, inputs, menus, pills and toggles — whether each looks like what it does, and whether hover, focus, active, selected, disabled, loading, empty and error states exist and are consistent. Where a state cannot be seen in a screenshot, say which screen and control should be checked.",
  rules:
    'Rules a developer can apply: from the measured styles and the screens, write the design rules the app should follow, one point each with priority "rule" — the colour tokens and what each is for, what each pill colour means, corner radius per component size, border and divider style, type scale and weights, button styles (primary, secondary, quiet) and spacing steps. Give exact values (hex or rgb, px) taken from the measurements, and where the app uses several values for one job, name the one to keep and the ones to retire. Then add must-fix or recommended points for inconsistencies.',
  type: "Typography: typefaces, weights and sizes in use and whether they form a clear scale, line length and leading, readability at the sizes used, and consistency of headings, labels and body across screens. Name the measured values when given.",
  usability:
    "Usability and key flows: walk each flow the brief names, step by step across the screens that show it. Say where a person would hesitate, get lost or make a mistake, what is missing between steps, and what would make the flow faster or clearer. Name each flow the brief lists that no screen shows.",
};

const instructionsFor = (topic: AuditTopicKey, brief: string): string => {
  const title = AUDIT_TOPICS.find((t) => t.key === topic)?.title ?? topic;
  return `Your task in this call: a deep audit of ONE topic across every screen of this review — ${title}. Other calls cover the other topics and each screen in turn, so stay on this topic and go deep: a careful senior reviewer's full account of it, not a summary.

${FOCUS[topic]}
${
  brief
    ? "\nThe client's brief is given after the screens. Cover everything it asks about this topic, respect anything it says must stay, and use its words for its areas and flows.\n"
    : ""
}
Reply with a single JSON object and nothing else (no markdown fences, no commentary):
{
  "summary": "1-2 sentences: how the app does on this topic, plainly.",
  "points": [
    {
      "priority": "must-fix" | "recommended" | "rule",
      "title": "Short, specific title",
      "detail": "2-4 sentences: what you saw and where, why it matters to the people using it, and exactly what to do, with values where they apply.",
      "screens": ["Titles of the screens it is seen on"]
    }
  ]
}

Aim for 10-16 points, ordered must-fix first. "must-fix" is anything that blocks a task, fails accessibility, or breaks consistency in a way users will notice; "recommended" is the rest; "rule" is for the developer rules topic only. Do not repeat the same point.`;
};

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/i;

const parseReply = (reply: string): unknown => {
  const text = JSON_FENCE.exec(reply)?.[1]?.trim() ?? reply.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const usesStyles = (topic: AuditTopicKey): boolean =>
  topic === "colour" || topic === "type" || topic === "rules";

/** The brief's coverage: each thing it asks for, and whether the screens show it. */
export const runCoveragePass = async ({
  brief,
  screens,
  title,
}: {
  brief: string;
  screens: ReviewScreen[];
  title?: string;
}): Promise<BriefCoverage[]> => {
  const sources = sourcesFromScreens(screens);
  if (!(brief && sources.length > 0)) {
    return [];
  }
  const { all } = await tileEachScreen(sources);
  const reply = await askClaude(
    COVERAGE_INSTRUCTIONS,
    tileContent(all, title, "", brief),
    COVERAGE_OUTPUT_TOKENS
  );
  const raw = parseReply(reply) as { coverage?: unknown } | null;
  return cleanCoverage(raw?.coverage);
};

export const runTopicPass = async ({
  brief = "",
  screens,
  title,
  topic,
}: {
  brief?: string;
  screens: ReviewScreen[];
  title?: string;
  topic: AuditTopicKey;
}): Promise<AuditTopic | null> => {
  const sources = sourcesFromScreens(screens);
  if (sources.length === 0) {
    throw new Error("Capture or upload at least one screen before an audit.");
  }
  const { all, byScreen } = await tileEachScreen(sources);
  const measured = usesStyles(topic)
    ? screens
        .filter((s) => s.styles)
        .map((s) => (s.styles ? describeStyles(s.title, s.styles) : ""))
        .join("\n\n")
    : "";
  const extra = measured
    ? `Measured styles, read from the live pages as they were captured:\n${measured}`
    : "No measured styles for these screens; judge values from the pictures and say they are estimates.";
  const content: Block[] = tileContent(all, title, extra, brief);
  if (topic === "accessibility") {
    const vision = await colourBlindTiles(byScreen);
    // Before the closing instruction, which tileContent puts last.
    content.splice(
      content.length - 1,
      0,
      ...vision.flatMap((v): Block[] => [
        {
          source: { data: v.data, media_type: "image/jpeg", type: "base64" },
          type: "image",
        },
        { text: `Above: ${v.label}`, type: "text" },
      ])
    );
  }
  const topicTitle = AUDIT_TOPICS.find((t) => t.key === topic)?.title ?? topic;
  const reply = await askClaude(
    instructionsFor(topic, brief),
    content,
    TOPIC_OUTPUT_TOKENS
  );
  return cleanAuditTopic(parseReply(reply), topicTitle);
};
