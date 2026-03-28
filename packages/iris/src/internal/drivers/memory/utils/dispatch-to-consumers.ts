import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store";

export const dispatchToConsumers = async (
  store: MemorySharedState,
  envelope: MemoryEnvelope,
): Promise<void> => {
  if (store.paused) return;

  const matching = store.consumers.filter((c) => c.topic === envelope.topic);
  if (matching.length === 0) return;

  if (envelope.broadcast) {
    for (const consumer of matching) {
      await consumer.callback(envelope);
    }
  } else {
    const key = `consumer:${envelope.topic}`;
    const idx = (store.roundRobinIndexes.get(key) ?? 0) % matching.length;
    store.roundRobinIndexes.set(key, idx + 1);
    await matching[idx].callback(envelope);
  }
};
