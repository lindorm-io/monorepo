import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { MemoryStore } from "../types/memory-store.js";

export const applyAutoIncrement = (
  row: Dict,
  metadata: EntityMetadata,
  getStore: () => MemoryStore,
  skipExisting = false,
): void => {
  for (const gen of metadata.generated) {
    if (gen.strategy !== "increment" && gen.strategy !== "identity") continue;
    // A value of null/undefined/0 means "unset" (JPA convention, matching the
    // redis/mongo executors) — only a real value suppresses auto-increment.
    if (skipExisting && row[gen.key] != null && row[gen.key] !== 0) continue;

    const store = getStore();
    const counterKey = `${metadata.entity.name}.${gen.key}`;
    const current = store.incrementCounters.get(counterKey) ?? 0;
    const next = current + 1;
    store.incrementCounters.set(counterKey, next);
    row[gen.key] = next;
  }
};
