import type { NatsSharedState } from "../types/nats-types.js";

export const stopNatsConsumer = async (
  state: NatsSharedState,
  consumerTag: string,
): Promise<void> => {
  const idx = state.consumerLoops.findIndex((l) => l.consumerTag === consumerTag);
  if (idx === -1) return;

  const loop = state.consumerLoops[idx];

  loop.abortController.abort();

  if (loop.messages) {
    try {
      await loop.messages.close();
    } catch {
      // Already closed
    }
  }

  try {
    await loop.loopPromise;
  } catch {
    // Expected — loop may reject when aborted
  }

  state.consumerLoops.splice(idx, 1);
};

export const stopAllNatsConsumers = async (state: NatsSharedState): Promise<void> => {
  for (const loop of state.consumerLoops) {
    loop.abortController.abort();

    if (loop.messages) {
      try {
        await loop.messages.close();
      } catch {
        // Already closed
      }
    }
  }

  await Promise.allSettled(state.consumerLoops.map((l) => l.loopPromise));

  state.consumerLoops.length = 0;
};
