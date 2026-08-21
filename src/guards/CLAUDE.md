# src/guards — Deterministic Safety Checks

## Determinism

No LLM calls, no network requests, no filesystem I/O, and no clock-dependent branching in this
directory. A guard must be a pure function: identical input produces identical output, every
time, and is trivially unit-testable without mocking anything. If a decision genuinely needs a
model's judgment, it belongs in the orchestrator or an agent, not here — guards are the
deterministic layer the rest of the system leans on.

## `confirmation.ts`

Parses a user's turn into `"confirm" | "deny" | "unclear"` via **normalized whole-phrase set
membership** — never `includes()` or other substring matching. The reason: `"לא מאשר"`
("I do not confirm") contains `"מאשר"`, which is itself a confirm phrase; a substring match
would misread a denial as a confirmation. `normalize()` handles case, punctuation, and Hebrew
niqqud; matching is exact equality against `CONFIRM_PHRASES` / `DENY_PHRASES`.

To add a phrase: add it to the appropriate set in **both** languages if a bilingual equivalent
makes sense, and add a case to `tests/confirmation.test.ts` exercising it — including, if the
new phrase is a superstring of an existing phrase in the other set, a test proving the two are
still distinguished. Anything not in either set is `"unclear"`, which is a safe default — never
widen matching just to reduce how often `"unclear"` fires; an unnecessary re-ask is cheap, a
misread confirmation is not.

## `injection.ts`

Rule-based regex pattern matching (`PATTERNS`) run on raw user input before anything else in
`handleTurn`. Each pattern carries a `reason` string that ends up in the trace. State this
plainly to anyone extending it: this is a fast, auditable **first line of defense**, not the
containment boundary. The actual containment is structural — no tool exists that can move money
or touch another account, and `ContactUpdateAgent` cannot write without passing the full gate in
`src/tools/invoke.ts`. Do not treat a passing `checkInjection` as license to relax the write
gate, and do not try to make this file "catch everything" at the cost of false positives on
legitimate requests — that trade-off belongs to the structural checks, not the pattern list.
