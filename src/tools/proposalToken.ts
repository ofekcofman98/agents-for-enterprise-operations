import { createHash } from "node:crypto";

/**
 * Binds a confirmation token to the exact {tool, args} payload (plus session
 * and a creation-time nonce so two identical proposals in the same session
 * don't collide). Recomputed at execution time in invoke.ts to guarantee the
 * confirmed write is exactly what the user was shown.
 */
export function hashProposal(
  tool: string,
  args: Record<string, unknown>,
  sessionId: string,
  nonce: number,
): string {
  // Exclude confirmationToken itself from the hashed payload: it doesn't
  // exist yet when the proposal is created, and is only added to args once
  // the user confirms — hashing it would make recomputation impossible.
  const { confirmationToken: _omit, ...rest } = args;
  const canonical = JSON.stringify({ tool, args: sortKeys(rest), sessionId, nonce });
  return createHash("sha256").update(canonical).digest("hex");
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
