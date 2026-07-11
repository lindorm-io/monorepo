import type { MetaGenerated } from "../types/metadata.js";

/**
 * Driver-agnostic decision for DB-side auto-increment generation: a field
 * participates when its generation strategy is `increment` or `identity` AND
 * its current value is unset. A value of `null`/`undefined`/`0` means "unset"
 * (JPA convention — zero-valued integer PKs indicate a transient entity), so
 * only a real non-zero value suppresses auto-increment.
 *
 * The per-driver mechanics (redis INCR keys, mongo `_proteus_sequences`,
 * memory counters) live with each driver; this is only the shared predicate.
 */
export const shouldAutoIncrement = (gen: MetaGenerated, value: unknown): boolean =>
  (gen.strategy === "increment" || gen.strategy === "identity") &&
  (value === null || value === undefined || value === 0);
