import type { IrisPersistenceDelayConfig } from "../../../types/source-options.js";
import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError.js";
import { IrisTransportError } from "../../../errors/IrisTransportError.js";
import type { IDelayStore } from "../../../interfaces/IrisDelayStore.js";
import { MemoryDelayStore } from "../MemoryDelayStore.js";
import { RedisDelayStore } from "../RedisDelayStore.js";

export const createDelayStore = async (
  config?: IrisPersistenceDelayConfig,
): Promise<IDelayStore> => {
  if (!config || config.type === "memory") {
    return new MemoryDelayStore();
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
      throw new IrisTransportError("Failed to connect delay store to Redis", {
        code: "delay_store_connection_failed",
        debug: { url: config.url },
        error: error instanceof Error ? error : undefined,
      });
    }

    return new RedisDelayStore(client, { ownedClient: true });
  }

  throw new IrisNotSupportedError("Unknown delay store type", {
    code: "unknown_delay_store_type",
    data: { type: (config as Record<string, string>).type },
  });
};
