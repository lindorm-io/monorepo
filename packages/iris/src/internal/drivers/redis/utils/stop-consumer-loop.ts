import type { RedisSharedState } from "../types/redis-types";

export const stopConsumerLoop = async (
  state: RedisSharedState,
  consumerTag: string,
): Promise<void> => {
  const idx = state.consumerLoops.findIndex((l) => l.consumerTag === consumerTag);
  if (idx === -1) return;

  const loop = state.consumerLoops[idx];

  // Abort + disconnect. Consumer connections are created with retryStrategy: null,
  // so disconnect() closes the socket immediately without triggering reconnection.
  // This interrupts any pending blocking XREADGROUP call.
  loop.abortController.abort();
  try {
    loop.connection.disconnect();
  } catch {
    // Already closed
  }

  try {
    await loop.loopPromise;
  } catch {
    // Expected — loop rejects when connection is closed mid-read
  }

  state.consumerLoops.splice(idx, 1);
};

export const stopAllConsumerLoops = async (state: RedisSharedState): Promise<void> => {
  for (const loop of state.consumerLoops) {
    loop.abortController.abort();
    try {
      loop.connection.disconnect();
    } catch {
      // Already closed
    }
  }

  await Promise.allSettled(state.consumerLoops.map((l) => l.loopPromise));

  state.consumerLoops.length = 0;
};
