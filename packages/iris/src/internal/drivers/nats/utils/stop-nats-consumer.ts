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
  // Snapshot so we don't mutate while iterating.
  const loops = [...state.consumerLoops];

  // Abort + close in parallel; each loop's for-await exits at the next abort
  // check or when its messages iterator throws on close.
  await Promise.all(
    loops.map(async (loop) => {
      loop.abortController.abort();
      if (loop.messages) {
        try {
          await loop.messages.close();
        } catch {
          // Already closed
        }
      }
    }),
  );

  // Drain: only return once every loop's for-await has actually exited.
  // Skipping this leaves zombie callbacks racing the next reset / publish.
  await Promise.allSettled(loops.map((l) => l.loopPromise));

  state.consumerLoops.length = 0;
};
