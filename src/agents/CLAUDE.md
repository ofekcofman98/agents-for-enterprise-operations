# src/agents — Sub-Agent Isolation Contract

## Every agent returns `AgentResult`

`AgentResult` (`types.ts`) is a discriminated union on `kind`:

```ts
{ kind: "say"; text: string }
{ kind: "askClarify"; question: string }
{ kind: "proposeWrite"; proposal: Omit<PendingProposal, "token" | "createdAt" | "status"> }
{ kind: "refuse"; reason: string }
```

An agent must return one of these — never a bare string, never `undefined`, never format the
final user-facing reply itself. `applyAgentResult` in `orchestrator.ts` is the only place a
`kind` is turned into a spoken reply and the only place session state (`pendingProposal`,
`awaitingClarification`) is mutated as a result.

## Stateless and isolated

- No module-level mutable state in an agent file.
- Agents never mutate `Session` directly — only the orchestrator does, via the setters in
  `session.ts`.
- Agents never import `src/db/mockDb.ts`, for reads or writes. All data access goes through
  `invokeTool` (`src/tools/invoke.js`), which validates args and traces the call.
- **Hard rule**: an agent must never import `src/tools/bank.writeTools.ts` and must never call
  `invokeTool` with a `readOnly: false` tool. `ContactUpdateAgent` expresses write intent
  *only* by returning `{ kind: "proposeWrite", ... }` — see `contactUpdateAgent.ts` for the
  pattern (it calls the LLM to extract a field/value, then returns a proposal; it does not, and
  must not, touch `updateContact`).

## Adding a new agent

The agent set is defined exactly once, in `src/agents/registry.ts` (`AGENTS`). Everything else —
the `AgentName` zod enum (`orchestrator/intents.ts`), the classifier prompt
(`orchestrator/classifier.ts`), the offline keyword router (`llm/fake.ts`), and dispatch
(`orchestrator/router.ts`) — derives from it. Never restate an agent's name, description, or
keywords in one of those files; if you're editing any of them to add an agent, stop, you're in
the wrong place.

1. Implement the handler in a new file here, returning `AgentResult`. Read-only agents call
   `invokeTool` directly like `balanceAgent.ts` / `loanStatusAgent.ts`; a write-capable agent
   follows the `contactUpdateAgent.ts` propose-only pattern.
2. Add one entry to `AGENTS` in `registry.ts`: `description` (what the classifier prompt tells
   the model), `keywords` (what `FakeLlmClient` matches offline, in `tests/` and when no API key
   is set), and `run`. `AGENTS` is `satisfies Record<string, AgentDefinition>`, so a malformed
   entry is a compile error.
3. Add a routing test in `tests/routing.test.ts` covering the new intent.

That's it — two files, one of them new.

**Why `AGENTS` is a plain `const` object and not `registerTool`-style side-effecting
registration** (compare `src/tools/registry.ts`): tools are already populated via import-time
`registerTool` calls that `cli.ts`/tests must remember to import. For agents that import-order
hazard buys nothing, since the full set is small and known at compile time — a static object
gives exhaustiveness checking (`Record<AgentName, …>` via `AgentName = keyof typeof AGENTS`) with
no risk of a forgotten side-effecting import silently dropping an agent. Don't "unify" the two
patterns; they're solving different problems.
