import { describe, it, expect, beforeAll } from "vitest";
import "../src/tools/bank.readTools.js";
import "../src/tools/bank.writeTools.js";
import { createSession, setPendingProposal } from "../src/session.js";
import { invokeTool, WriteBlockedError } from "../src/tools/invoke.js";
import { hashProposal } from "../src/tools/proposalToken.js";
import { getCustomer } from "../src/db/mockDb.js";

const ctx = { traceId: "t1", turnId: "u1" };

function makeArgs(newValue: string) {
  return { customerId: "cust-1", field: "phone" as const, newValue };
}

describe("write guardrail (tools/invoke.ts)", () => {
  it("blocks a write with no pending proposal at all", () => {
    const session = createSession("cust-1");
    expect(() =>
      invokeTool("updateContact", { ...makeArgs("050-0000000"), confirmationToken: "whatever" }, session, ctx),
    ).toThrow(WriteBlockedError);
  });

  it("blocks a write whose proposal exists but is not confirmed", () => {
    const session = createSession("cust-1");
    const nonce = Date.now();
    const args = makeArgs("050-1111111");
    const token = hashProposal("updateContact", args, session.id, nonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: nonce, question: "?", status: "awaiting" });

    expect(() => invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx)).toThrow(WriteBlockedError);
  });

  it("blocks a write whose token doesn't match the pending proposal", () => {
    const session = createSession("cust-1");
    const nonce = Date.now();
    const args = makeArgs("050-2222222");
    const token = hashProposal("updateContact", args, session.id, nonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: nonce, question: "?", status: "confirmed" });

    expect(() =>
      invokeTool("updateContact", { ...args, confirmationToken: "forged-token" }, session, ctx),
    ).toThrow(WriteBlockedError);
  });

  it("blocks a write where confirmed args are swapped after confirmation (payload binding)", () => {
    const session = createSession("cust-1");
    const nonce = Date.now();
    const originalArgs = makeArgs("050-3333333");
    const token = hashProposal("updateContact", originalArgs, session.id, nonce);
    setPendingProposal(session, { tool: "updateContact", args: originalArgs, token, createdAt: nonce, question: "?", status: "confirmed" });

    // Attacker/bug swaps the value after confirmation but reuses the valid token.
    const swappedArgs = makeArgs("050-9999999");
    expect(() =>
      invokeTool("updateContact", { ...swappedArgs, confirmationToken: token }, session, ctx),
    ).toThrow(WriteBlockedError);
  });

  it("allows a write when a confirmed, payload-matching token is supplied, and consumes it", () => {
    const session = createSession("cust-1");
    const nonce = Date.now();
    const args = makeArgs("050-4444444");
    const token = hashProposal("updateContact", args, session.id, nonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: nonce, question: "?", status: "confirmed" });

    invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx);
    expect(getCustomer("cust-1")?.phone).toBe("050-4444444");
    expect(session.pendingProposal).toBeNull(); // single-use: consumed
  });

  it("rejects replaying an already-consumed token", () => {
    const session = createSession("cust-1");
    const nonce = Date.now();
    const args = makeArgs("050-5555555");
    const token = hashProposal("updateContact", args, session.id, nonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: nonce, question: "?", status: "confirmed" });
    invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx);

    // session.pendingProposal is now null; replaying the same token must fail.
    expect(() => invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx)).toThrow(WriteBlockedError);
  });

  it("invalidates the old token when a new proposal supersedes it (propose phone, then address, confirm)", () => {
    const session = createSession("cust-1");

    const phoneArgs = makeArgs("050-6666666");
    const phoneNonce = Date.now();
    const phoneToken = hashProposal("updateContact", phoneArgs, session.id, phoneNonce);
    setPendingProposal(session, { tool: "updateContact", args: phoneArgs, token: phoneToken, createdAt: phoneNonce, question: "?", status: "awaiting" });

    // User changes their mind before confirming: a new proposal supersedes the old one.
    const addressArgs = { customerId: "cust-1", field: "address" as const, newValue: "99 New Rd" };
    const addressNonce = phoneNonce + 1;
    const addressToken = hashProposal("updateContact", addressArgs, session.id, addressNonce);
    setPendingProposal(session, { tool: "updateContact", args: addressArgs, token: addressToken, createdAt: addressNonce, question: "?", status: "confirmed" });

    // A "yes" bound to the stale phone token must not apply the address (or phone) change.
    expect(() =>
      invokeTool("updateContact", { ...phoneArgs, confirmationToken: phoneToken }, session, ctx),
    ).toThrow(WriteBlockedError);

    // The live (address) proposal, confirmed with its own token, succeeds.
    invokeTool("updateContact", { ...addressArgs, confirmationToken: addressToken }, session, ctx);
    expect(getCustomer("cust-1")?.address).toBe("99 New Rd");
    expect(getCustomer("cust-1")?.phone).not.toBe("050-6666666"); // phone proposal never applied
  });

  it("blocks a confirmed write whose token has expired", () => {
    const session = createSession("cust-1");
    const args = makeArgs("050-7777777");
    const staleNonce = Date.now() - 6 * 60_000; // 6 minutes ago, past the 5-minute TTL
    const token = hashProposal("updateContact", args, session.id, staleNonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: staleNonce, question: "?", status: "confirmed" });

    expect(() => invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx)).toThrow(WriteBlockedError);
    expect(session.pendingProposal).toBeNull(); // stale proposal is cleared, not left retryable
  });

  it("allows a confirmed write whose token is still within the TTL", () => {
    const session = createSession("cust-1");
    const args = makeArgs("050-8888888");
    const freshNonce = Date.now() - 4 * 60_000; // 4 minutes ago, inside the 5-minute TTL
    const token = hashProposal("updateContact", args, session.id, freshNonce);
    setPendingProposal(session, { tool: "updateContact", args, token, createdAt: freshNonce, question: "?", status: "confirmed" });

    invokeTool("updateContact", { ...args, confirmationToken: token }, session, ctx);
    expect(getCustomer("cust-1")?.phone).toBe("050-8888888");
  });

  it("read tools execute directly with no proposal or confirmation required", () => {
    const session = createSession("cust-1");
    const result = invokeTool("getBalance", { customerId: "cust-1" }, session, ctx) as { balance: number };
    expect(result.balance).toBeGreaterThan(0);
  });
});
