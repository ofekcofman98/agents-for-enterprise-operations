import { describe, it, expect } from "vitest";
import { FakeLlmClient } from "../src/llm/fake.js";
import { route, applyRoutingPolicy } from "../src/orchestrator/router.js";

const llm = new FakeLlmClient();
const ctx = { traceId: "t1", turnId: "u1" };

describe("router", () => {
  it("routes an unambiguous balance question", async () => {
    const result = await route(llm, "what's my balance?", ctx);
    expect(result.decision).toBe("BalanceAgent");
  });

  it("routes an unambiguous loan question", async () => {
    const result = await route(llm, "what's the status of my loan?", ctx);
    expect(result.decision).toBe("LoanStatusAgent");
  });

  it("asks a clarifying question when intent is ambiguous", async () => {
    const result = await route(llm, "I need help with my account stuff", ctx);
    expect(result.decision).toBe("clarify");
    expect(result.clarifyingQuestion).toBeTruthy();
  });

  it("asks a clarifying question when multiple intents collide", async () => {
    const result = await route(llm, "my balance and my loan status please", ctx);
    expect(result.decision).toBe("clarify");
  });
});

describe("applyRoutingPolicy (no LLM required)", () => {
  it("passes through a decision at or above the confidence threshold", () => {
    const result = applyRoutingPolicy({ decision: "BalanceAgent", confidence: 0.9, reason: "clear" });
    expect(result.decision).toBe("BalanceAgent");
  });

  it("downgrades a below-threshold decision to clarify", () => {
    const result = applyRoutingPolicy({ decision: "BalanceAgent", confidence: 0.3, reason: "unsure" });
    expect(result.decision).toBe("clarify");
    expect(result.clarifyingQuestion).toBeTruthy();
  });

  it("leaves clarify/refuse decisions untouched regardless of confidence", () => {
    expect(applyRoutingPolicy({ decision: "clarify", confidence: 0, reason: "x" }).decision).toBe("clarify");
    expect(applyRoutingPolicy({ decision: "refuse", confidence: 0, reason: "x" }).decision).toBe("refuse");
  });
});
