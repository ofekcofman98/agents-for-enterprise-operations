# Decisions

**1. The write guardrail is enforced structurally, not via prompting.**
`ContactUpdateAgent` has no code path to a write tool — it can only return a
`proposeWrite` result. Execution requires a token cryptographically bound to
the exact `{tool, args}` payload (`src/tools/proposalToken.ts`), checked in
the single choke point `src/tools/invoke.ts`, single-use, and invalidated on
denial or supersession by a later proposal. This means "the LLM decided not
to write without asking" is not the safety mechanism — even a compromised or
hallucinating agent physically cannot call the write tool with an
unconfirmed or mismatched payload. Why: the client's hard constraint is that
a wrong write is unacceptable; a rule an LLM merely *usually* follows doesn't
meet that bar, but a rule enforced in a few lines of ordinary code does.

**2. Orchestration (a router deciding, in code, which of three sub-agents to
invoke) over choreography (agents reacting to each other's events).** With
three fixed intents and a hard requirement to log "why did X get routed and
what did it call," a central decision point that's traced once is simpler to
audit than emergent behavior across independently-triggered agents. I'd
choose choreography instead if the set of participants were open-ended and
loosely coupled (e.g., many independent event-driven services reacting to a
"customer updated" event) where no single place should own sequencing.

**3. Deliberately not built: real STT/TTS, barge-in, and a full language
detector.** Task.md explicitly allows text simulating a transcript for the
core, and the rubric rewards "a solid core over a shaky stretch." I spent the
budget on the guardrail, the routing/ambiguity/clarification state machine,
and traceability instead, and kept voice behind a port
(`src/voice/port.ts`) so a real adapter is a self-contained addition rather
than a refactor. Given more time, real STT/TTS and barge-in handling would be
the next things I'd add, in that order.

## Where a hallucination could cascade, and what stops it

The two places an LLM's output feeds a decision are the router (classifying
intent) and the contact-field extractor. Both are constrained: the router's
output is parsed against a `zod` schema and a confidence threshold enforced
in code (`ROUTING_CONFIDENCE_THRESHOLD` in `src/orchestrator/intents.ts`) —
malformed or low-confidence output falls back to a clarifying question, never
a guessed route. The extractor's output only ever produces a *proposal*,
never a write; a hallucinated field/value still requires a human to read it
back and confirm before `invoke.ts` will touch the mock DB. So a
hallucination can, at worst, ask a wrong clarifying question or propose the
wrong change — it cannot silently execute one.
