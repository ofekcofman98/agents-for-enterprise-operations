import type { z } from "zod";

export interface ToolDef<TArgs = any, TResult = any> {
  name: string;
  description: string;
  schema: z.ZodType<TArgs>;
  /** Read tools execute immediately. Write tools require invoke.ts's confirmation gate. */
  readOnly: boolean;
  handler: (args: TArgs) => TResult;
}

const registry = new Map<string, ToolDef>();

export function registerTool(def: ToolDef): void {
  if (registry.has(def.name)) throw new Error(`Tool already registered: ${def.name}`);
  registry.set(def.name, def);
}

export function getTool(name: string): ToolDef | undefined {
  return registry.get(name);
}

export function allTools(): ToolDef[] {
  return [...registry.values()];
}
