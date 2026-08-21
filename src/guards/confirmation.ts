/**
 * Deterministic yes/no parsing — no LLM in this path. Confirmation of a
 * money-adjacent write must not depend on model behavior.
 */
export type ConfirmationResult = "confirm" | "deny" | "unclear";

const CONFIRM_PHRASES = new Set([
  "yes", "y", "yeah", "yep", "yup", "ok", "okay", "confirm", "confirmed", "go ahead", "sure",
  "כן", "אישור", "מאשר", "מאשרת", "בסדר", "בטח", "נכון", "ברור", "יאפ", "יאללה", "חיובי",
]);

const DENY_PHRASES = new Set([
  "no", "n", "nope", "nah", "cancel", "stop", "don't", "dont",
  "לא", "ביטול", "בטל", "בטלי", "לא מאשר", "לא מאשרת", "שנייה", "שניה", "רגע", "שלילי",
]);

/** Strip Hebrew niqqud (combining marks U+0591–U+05C7) and normalize punctuation/case. */
function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:'"]+$/g, "")
    .trim();
}

/**
 * Whole-phrase match only — never substring/`includes()`. "לא מאשר" contains
 * "מאשר" (a confirm phrase) but means the opposite; matching by substring
 * would misclassify a denial as a confirmation.
 */
export function parseConfirmation(input: string): ConfirmationResult {
  const normalized = normalize(input);
  if (CONFIRM_PHRASES.has(normalized)) return "confirm";
  if (DENY_PHRASES.has(normalized)) return "deny"; // ? no llm fallback?
  return "unclear";
}
