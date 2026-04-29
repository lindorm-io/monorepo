import type { EnsureNatsStreamOptions } from "../types/nats-types.js";

export type { EnsureNatsStreamOptions };

export const ensureNatsStream = async (
  options: EnsureNatsStreamOptions,
): Promise<void> => {
  const { jsm, streamName, subjects, logger } = options;

  try {
    await jsm.streams.info(streamName);
    logger.debug("Stream already exists", { streamName });
  } catch (err: any) {
    // Stream not found — create it
    if (String(err?.message).includes("stream not found") || err?.code === "404") {
      await jsm.streams.add({
        name: streamName,
        subjects,
        retention: "limits",
        storage: "file",
        max_consumers: -1,
        max_msgs: -1,
        max_bytes: -1,
        max_age: 604_800_000_000_000, // 7 days in nanoseconds
        discard: "old",
        num_replicas: 1,
      });
      logger.debug("Stream created", { streamName, subjects });
    } else {
      throw err;
    }
  }
};
