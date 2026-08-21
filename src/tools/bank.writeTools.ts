import { z } from "zod";
import { registerTool } from "./registry.js";
import { applyContactUpdate } from "../db/mockDb.js";

/**
 * Write tools are registered with readOnly: false. They are never called
 * directly by an agent — only through tools/invoke.ts, which refuses to
 * execute any readOnly:false tool without a valid, payload-matching,
 * single-use confirmation token. See invoke.ts for the actual gate.
 */
const UpdateContactArgs = z.object({
  customerId: z.string(),
  field: z.enum(["phone", "address"]),
  newValue: z.string().min(1),
  /** Required by the schema so a call missing it fails validation before it
   *  ever reaches the write gate — belt and suspenders with invoke.ts's check. */
  confirmationToken: z.string().min(1),
});

registerTool({
  name: "updateContact",
  description: "Update the customer's phone or address on file. Requires a confirmed proposal token.",
  schema: UpdateContactArgs,
  readOnly: false,
  handler: ({ customerId, field, newValue, confirmationToken }) =>
    applyContactUpdate(customerId, field, newValue, confirmationToken),
});
