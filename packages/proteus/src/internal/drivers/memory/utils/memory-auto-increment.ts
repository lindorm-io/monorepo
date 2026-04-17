import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { MemoryStore } from "../types/memory-store";

export const applyAutoIncrement = (
  row: Dict,
  metadata: EntityMetadata,
  getStore: () => MemoryStore,
  skipExisting = false,
): void => {
  for (const gen of metadata.generated) {
    if (gen.strategy !== "increment" && gen.strategy !== "identity") continue;
    if (skipExisting && gen.key in row) continue;

    const store = getStore();
    const counterKey = `${metadata.entity.name}.${gen.key}`;
    const current = store.incrementCounters.get(counterKey) ?? 0;
    const next = current + 1;
    store.incrementCounters.set(counterKey, next);
    row[gen.key] = next;
  }
};
