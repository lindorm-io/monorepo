import type { Redis } from "ioredis";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { buildIncrementKey } from "./build-increment-key";

/**
 * Apply auto-increment values using Redis INCR for each `@Generated("increment")`
 * or `@Generated("identity")` field.
 *
 * Only applies when the current row value is null, undefined, or 0 — fields
 * with existing non-zero values are left untouched. A value of `0` is treated
 * as "unset" and will be overwritten by auto-increment. This follows the JPA
 * convention where zero-valued integer PKs indicate a transient (unsaved) entity.
 *
 * The counter key (`{ns:}seq:{name}:{field}`) uses Redis INCR for atomic
 * monotonic increment. Counter keys persist independently of entity data —
 * they are NOT deleted by `RedisRepository.clear()` to ensure monotonic
 * correctness across clear/repopulate cycles.
 */
export const applyRedisAutoIncrement = async (
  client: Redis,
  row: Dict,
  metadata: EntityMetadata,
  namespace: string | null,
): Promise<void> => {
  for (const gen of metadata.generated) {
    if (gen.strategy !== "increment" && gen.strategy !== "identity") continue;

    const current = row[gen.key];
    if (current != null && current !== 0) continue;

    const key = buildIncrementKey(metadata.target, gen.key, namespace);
    const next = await client.incr(key);
    row[gen.key] = next;
  }
};
