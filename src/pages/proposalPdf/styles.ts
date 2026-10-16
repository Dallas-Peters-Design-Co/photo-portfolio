import { StyleSheet } from "@react-pdf/renderer";
import { PROPOSAL_DISPLAY_FONT, PROPOSAL_FONT } from "./fonts";

/**
 * The sheet's tokens, in points. Same ink, rule and tint as ProposalPage.css,
 * converted from OKLCH once here; the blue is the logo's own.
 */
export const INK = "#0f0f0f";
export const INK_SOFT = "#636363";
export const RULE = "#dedede";
export const TINT = "#f3f3f3";
export const BLUE = "#0e29f1";

const PROSE = 10.5;
const SMALL = 9;
const MICRO = 7.5;

export const styles = StyleSheet.create({
  addon: {
    borderBottomColor: RULE,
    borderBottomWidth: 1,
    flexDirection: "row",
    fontSize: PROSE,
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  addonLast: { borderBottomWidth: 0 },
  addonPrice: { color: INK_SOFT },
  // Line height lives here and not on the page: a line height on the Page
  // makes react-pdf drop an absolutely positioned fixed footer.
  body: { lineHeight: 1.6 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  clause: {
    borderBottomColor: RULE,
    borderBottomWidth: 1,
    marginBottom: 22,
    paddingBottom: 22,
  },
  clauseLast: { borderBottomWidth: 0, marginBottom: 0 },
  clauseTitle: {
    fontFamily: PROPOSAL_DISPLAY_FONT,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.6,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  footer: {
    bottom: 28,
    color: INK_SOFT,
    fontSize: MICRO,
    left: 56,
    position: "absolute",
    width: 500,
  },
  heading: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    marginTop: 8,
  },
  italic: { fontStyle: "italic" },
  kicker: {
    color: INK_SOFT,
    fontSize: MICRO,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  label: {
    color: INK_SOFT,
    fontSize: MICRO,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  link: { color: INK, textDecoration: "underline" },
  masthead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  option: {
    borderRadius: 3,
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
    padding: 10,
  },
  optionBody: { flex: 1 },
  optionFacts: { color: INK_SOFT, fontSize: SMALL, marginTop: 2 },
  optionFee: {
    fontSize: PROSE,
    fontWeight: 600,
    lineHeight: 1.6,
    textAlign: "right",
  },
  optionFeeBox: { alignItems: "flex-end", width: 90 },
  optionFeeNote: {
    color: INK_SOFT,
    fontSize: 8,
    fontWeight: 400,
    textAlign: "right",
  },
  optionIncludes: { fontSize: SMALL, marginTop: 4 },
  optionIndex: { fontSize: PROSE, fontWeight: 600, lineHeight: 1.6, width: 26 },
  optionSuggested: { backgroundColor: TINT },
  page: {
    borderTopColor: BLUE,
    borderTopWidth: 9,
    color: INK,
    fontFamily: PROPOSAL_FONT,
    fontSize: PROSE,
    paddingBottom: 60,
    paddingHorizontal: 56,
    paddingTop: 44,
  },
  parties: { flexDirection: "row", gap: 12, marginBottom: 24 },
  party: {
    borderColor: RULE,
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    fontSize: SMALL,
    lineHeight: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  partyLabel: {
    color: INK_SOFT,
    fontSize: MICRO,
    letterSpacing: 1.1,
    marginTop: 7,
    textTransform: "uppercase",
  },
  partyLabelFirst: { marginTop: 0 },
  partyValue: { marginTop: 1 },
  prose: { marginBottom: 7, maxWidth: 420 },
  quote: {
    borderLeftColor: RULE,
    borderLeftWidth: 2,
    marginBottom: 7,
    paddingLeft: 10,
  },
  run: { fontWeight: 600 },
  sigBlock: { flex: 1 },
  sigLine: {
    borderBottomColor: INK,
    borderBottomWidth: 1,
    fontSize: 15,
    lineHeight: 1.2,
    marginBottom: 6,
    minHeight: 30,
    paddingBottom: 4,
  },
  sigNote: { color: INK_SOFT, fontSize: SMALL, marginTop: 2 },
  signatures: { flexDirection: "row", gap: 28, marginTop: 18 },
  smallList: { fontSize: SMALL },
  step: { flexDirection: "row", marginBottom: 4 },
  stepNumber: { width: 16 },
  stepText: { flex: 1 },
  title: {
    fontFamily: PROPOSAL_DISPLAY_FONT,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -1,
    lineHeight: 1.1,
    marginBottom: 24,
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    fontSize: 8,
    fontWeight: 600,
    gap: 8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
