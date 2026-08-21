/** In-memory mock of "bank systems". Not persisted; reset on process restart. */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface Account {
  customerId: string;
  accountId: string;
  balance: number;
  currency: string;
}

export interface Loan {
  customerId: string;
  loanId: string;
  status: "pending" | "approved" | "denied" | "disbursed";
  amount: number;
}

export interface ChangeLogEntry {
  id: string;
  customerId: string;
  field: "phone" | "address";
  oldValue: string;
  newValue: string;
  at: number;
  confirmationToken: string;
}

const customers = new Map<string, Customer>([
  ["cust-1", { id: "cust-1", name: "Dana Levi", phone: "050-1234567", address: "12 Herzl St, Tel Aviv" }],
]);

const accounts = new Map<string, Account>([
  ["cust-1", { customerId: "cust-1", accountId: "acc-1", balance: 15230.5, currency: "ILS" }],
]);

const loans = new Map<string, Loan>([
  ["cust-1", { customerId: "cust-1", loanId: "loan-1", status: "pending", amount: 50000 }],
]);

/** Append-only — this is the audit trail for every write that actually executed. */
export const changeLog: ChangeLogEntry[] = [];

export function getCustomer(customerId: string): Customer | undefined {
  return customers.get(customerId);
}

export function getBalance(customerId: string): Account | undefined {
  return accounts.get(customerId);
}

export function getLoanStatus(customerId: string): Loan | undefined {
  return loans.get(customerId);
}

/** Only ever called from tools/invoke.ts after the write gate passes. */
export function applyContactUpdate(
  customerId: string,
  field: "phone" | "address",
  newValue: string,
  confirmationToken: string,
): ChangeLogEntry {
  const customer = customers.get(customerId);
  if (!customer) throw new Error(`Unknown customer ${customerId}`);
  const oldValue = customer[field];
  customer[field] = newValue;
  const entry: ChangeLogEntry = {
    id: `chg-${changeLog.length + 1}`,
    customerId,
    field,
    oldValue,
    newValue,
    at: Date.now(),
    confirmationToken,
  };
  changeLog.push(entry);
  return entry;
}
