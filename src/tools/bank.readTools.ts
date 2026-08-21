import { z } from "zod";
import { registerTool } from "./registry.js";
import { getBalance, getLoanStatus, getCustomer } from "../db/mockDb.js";

const CustomerArgs = z.object({ customerId: z.string() });

registerTool({
  name: "getBalance",
  description: "Look up the customer's account balance.",
  schema: CustomerArgs,
  readOnly: true,
  handler: ({ customerId }) => {
    const account = getBalance(customerId);
    if (!account) throw new Error(`No account found for customer ${customerId}`);
    return account;
  },
});

registerTool({
  name: "getLoanStatus",
  description: "Look up the status of the customer's loan application.",
  schema: CustomerArgs,
  readOnly: true,
  handler: ({ customerId }) => {
    const loan = getLoanStatus(customerId);
    if (!loan) throw new Error(`No loan found for customer ${customerId}`);
    return loan;
  },
});

registerTool({
  name: "getCustomer",
  description: "Look up the customer's profile (name, phone, address) on file.",
  schema: CustomerArgs,
  readOnly: true,
  handler: ({ customerId }) => {
    const customer = getCustomer(customerId);
    if (!customer) throw new Error(`No customer found for ${customerId}`);
    return customer;
  },
});
