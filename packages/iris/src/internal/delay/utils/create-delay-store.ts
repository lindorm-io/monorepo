import type { IrisPersistenceDelayConfig } from "../../../types/source-options";
import type { IDelayStore } from "../../../interfaces/IrisDelayStore";
import { MemoryDelayStore } from "../MemoryDelayStore";
import { RedisDelayStore } from "../RedisDelayStore";

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
    } catch (cause) {
      throw new Error(`Failed to connect delay store to Redis at ${config.url}`, {
        cause,
      });
    }

    return new RedisDelayStore(client, { ownedClient: true });
  }

  throw new Error(`Unknown delay store type: ${(config as Record<string, string>).type}`);
};
