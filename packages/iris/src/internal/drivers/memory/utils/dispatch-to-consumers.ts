import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store.js";
import { cloneEnvelopeForDelivery } from "./clone-envelope.js";

export const dispatchToConsumers = async (
  store: MemorySharedState,
  envelope: MemoryEnvelope,
): Promise<void> => {
  if (store.paused) return;

  const matching = store.consumers.filter((c) => c.topic === envelope.topic);
  if (matching.length === 0) return;

  if (envelope.broadcast) {
    for (const consumer of matching) {
      await consumer.callback(cloneEnvelopeForDelivery(envelope));
    }
    return;
  }

  // Competing consumers compete within their queue group; each distinct queue
  // group independently receives the message (round-robined across its members).
  const queueGroups = new Map<string, typeof matching>();

  for (const consumer of matching) {
    const group = queueGroups.get(consumer.queue) ?? [];
    group.push(consumer);
    queueGroups.set(consumer.queue, group);
  }

  for (const [queueName, group] of queueGroups) {
    const key = `consumer:${envelope.topic}:${queueName}`;
    const idx = (store.roundRobinIndexes.get(key) ?? 0) % group.length;
    store.roundRobinIndexes.set(key, idx + 1);
    await group[idx].callback(cloneEnvelopeForDelivery(envelope));
  }
};
