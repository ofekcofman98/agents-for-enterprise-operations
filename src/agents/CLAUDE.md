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

1. Add the name to the `AgentName` enum in `src/orchestrator/intents.ts`.
2. Extend the router system prompt in `src/orchestrator/classifier.ts` and the keyword rules in
   `src/llm/fake.ts` (`routeByKeyword`) so the new intent is classifiable offline, without an
   API key.
3. Add the entry to `AGENT_HANDLERS` in `src/orchestrator/router.ts`. This is a `Record<AgentName,
   …>`, so a missing entry is a compile error, not a silent fall-through — you cannot forget this
   step.
4. Implement the handler in a new file here, returning `AgentResult`. Read-only agents call
   `invokeTool` directly like `balanceAgent.ts` / `loanStatusAgent.ts`; a write-capable agent
   follows the `contactUpdateAgent.ts` propose-only pattern.
5. Add a routing test in `tests/routing.test.ts` covering the new intent.
