import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store";

export const dispatchToSubscribers = async (
  store: MemorySharedState,
  envelope: MemoryEnvelope,
): Promise<void> => {
  if (store.paused) return;

  const matching = store.subscriptions.filter((s) => s.topic === envelope.topic);

  const broadcast: typeof matching = [];
  const queueGroups = new Map<string, typeof matching>();

  for (const sub of matching) {
    if (sub.queue === null) {
      broadcast.push(sub);
    } else {
      const group = queueGroups.get(sub.queue) ?? [];
      group.push(sub);
      queueGroups.set(sub.queue, group);
    }
  }

  for (const sub of broadcast) {
    await sub.callback(envelope);
  }

  for (const [queueName, group] of queueGroups) {
    const key = `sub:${envelope.topic}:${queueName}`;
    const idx = (store.roundRobinIndexes.get(key) ?? 0) % group.length;
    store.roundRobinIndexes.set(key, idx + 1);
    await group[idx].callback(envelope);
  }
};
