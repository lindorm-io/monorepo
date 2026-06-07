import type { IrisPersistenceDeadLetterConfig } from "../../../types/source-options.js";
import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError.js";
import { IrisTransportError } from "../../../errors/IrisTransportError.js";
import type { IDeadLetterStore } from "../../../interfaces/IrisDeadLetterStore.js";
import { MemoryDeadLetterStore } from "../MemoryDeadLetterStore.js";
import { RedisDeadLetterStore } from "../RedisDeadLetterStore.js";

export const createDeadLetterStore = async (
  config?: IrisPersistenceDeadLetterConfig,
): Promise<IDeadLetterStore> => {
  if (!config || config.type === "memory") {
    return new MemoryDeadLetterStore();
  }

  if (config.type === "custom") {
    return config.store;
  }

  if (config.type === "redis") {
    const { Redis } = await import("ioredis");
    const client = new Redis(config.url);

    try {
      await client.ping();
    } catch (error) {
      throw new IrisTransportError("Failed to connect dead letter store to Redis", {
        code: "dead_letter_store_connection_failed",
        debug: { url: config.url },
        error: error instanceof Error ? error : undefined,
      });
    }

    return new RedisDeadLetterStore(client, { ownedClient: true });
  }

  throw new IrisNotSupportedError("Unknown dead letter store type", {
    code: "unknown_dead_letter_store_type",
    data: { type: (config as Record<string, string>).type },
  });
};
