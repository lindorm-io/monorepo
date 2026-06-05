import { expect } from "vitest";
import { z } from "zod";

if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol("Symbol.metadata");
}

// Zod schemas serialise to their full enumerable method surface by default,
// which churns on every zod release and makes snapshots brittle. Render them
// as their stable JSON Schema shape instead, so snapshots track the schema's
// structure rather than zod's internal API.
expect.addSnapshotSerializer({
  test: (val: unknown) => val instanceof z.ZodType,
  serialize: (val, config, indentation, depth, refs, printer) => {
    let shape: unknown;
    try {
      shape = z.toJSONSchema(val as z.ZodType, { unrepresentable: "any" });
    } catch {
      shape = { type: (val as z.ZodType).def?.type ?? "unknown" };
    }
    return `ZodSchema ${printer(shape, config, indentation, depth, refs)}`;
  },
});
