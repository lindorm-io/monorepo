import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { shouldAutoIncrement } from "../../../entity/utils/should-auto-increment.js";
import type { MemoryStore } from "../types/memory-store.js";

export const applyAutoIncrement = (
  row: Dict,
  metadata: EntityMetadata,
  getStore: () => MemoryStore,
  skipExisting = false,
): void => {
  for (const gen of metadata.generated) {
    // With skipExisting=false the current value never suppresses generation.
    if (!shouldAutoIncrement(gen, skipExisting ? row[gen.key] : undefined)) continue;

    const store = getStore();
    const counterKey = `${metadata.entity.name}.${gen.key}`;
    const current = store.incrementCounters.get(counterKey) ?? 0;
    const next = current + 1;
    store.incrementCounters.set(counterKey, next);
    row[gen.key] = next;
  }
};
