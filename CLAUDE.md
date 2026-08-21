# Meridian Bank Voice Agent — Project Guidelines

## Overview

A voice-driven banking support orchestrator for "Meridian Bank". A central router
(`src/orchestrator/`) classifies each turn (text transcript in, text out; voice is behind
`src/voice/port.ts`) and dispatches to one of three sub-agents: `BalanceAgent`,
`LoanStatusAgent` (read-only), `ContactUpdateAgent` (write, propose-only). This is a banking
system — a wrong write is unacceptable. Every rule below exists to make that true in code, not
in a prompt.

Sub-directories carry their own `CLAUDE.md`; this file does not repeat them:
`src/agents/CLAUDE.md`, `src/tools/CLAUDE.md`, `src/guards/CLAUDE.md`.

## Architecture invariants

- **Orchestration, not choreography.** One router decides, in code, which sub-agent handles a
  turn. Do not add agent-to-agent messaging or event fan-out — a single decision point is what
  makes routing traceable and auditable.
- **The LLM has exactly two jobs**: intent classification (`src/orchestrator/classifier.ts`) and
  contact-field extraction (`src/agents/contactUpdateAgent.ts`). Every LLM output crosses into
  code through a `zod` parse and, for routing, a confidence threshold
  (`ROUTING_CONFIDENCE_THRESHOLD` in `src/orchestrator/intents.ts`) — malformed or
  low-confidence output fails closed to `clarify`, never a guessed route. Do not let an LLM
  output drive a decision without passing through a schema first.
- **Classifier / policy / dispatch are separate.** `classifier.ts` is the only place a router LLM
  response is parsed; `router.ts` is pure deterministic policy (`applyRoutingPolicy`'s confidence
  threshold) plus the `AGENT_HANDLERS` dispatch table — no LLM call lives there. Adding an agent
  means adding a table entry, not a conditional; a missing entry is a compile error.
- **Turn precedence is normative.** `handleTurn` in `src/orchestrator/orchestrator.ts` resolves a
  turn by running the `STAGES` list in `turnStages.ts`, in order: injection check → pending write
  confirmation → pending clarification → fresh routing. Changing that order is an architectural
  change — get explicit sign-off, don't just refactor it.

## Guardrail policy

Zero direct writes. Every state change requires an explicit, proposal-specific user
confirmation before it executes. The mechanism (payload-bound tokens, single-use, TTL-expiring)
lives in `src/tools/invoke.ts` — see `src/tools/CLAUDE.md` for the exact conditions enforced.
Never weaken that gate to make a feature easier to ship; add a test to `tests/guardrail.test.ts`
instead.

## Observability

Every turn opens a trace (`traceId` = session id, `turnId` = per-turn) via `src/obs/trace.ts`,
and every tool call logs `{tool, args, result | error, durationMs}`. New decision points (a new
guard, a new routing branch, a new agent outcome) add a `TraceEvent` variant in `trace.ts` and
call `trace()` — never a bare `console.log` for something that affects behavior. The bar: a
whole conversation must be reconstructable from `logs/trace.jsonl` alone.

## Testing & code quality

- Strict TypeScript (`npm run typecheck`) and `npm test` (vitest) must both pass before calling
  a change done.
- Every new safety rule ships with a test that fails without it (see `tests/guardrail.test.ts`
  for the pattern: write one test per bypass attempt, not just one happy-path test).
- Keep these edge-case families covered as the code grows: prompt injection
  (`tests/injection.test.ts`), routing ambiguity (`tests/routing.test.ts`), write-gate bypass
  (`tests/guardrail.test.ts`), and bilingual confirmation parsing
  (`tests/confirmation.test.ts`).
- Reuse the existing choke points — `invokeTool`, `trace`, `hashProposal`, `parseConfirmation`,
  `checkInjection` — rather than re-implementing similar logic elsewhere. No copy-pasted
  variants of a guard or the write gate; if a rule needs to be duplicated, factor it into the
  shared function instead.
- Favor small, readable, single-purpose functions over clever ones — this codebase is meant to
  be auditable by a human reviewer in the walkthrough, not just by tests.
