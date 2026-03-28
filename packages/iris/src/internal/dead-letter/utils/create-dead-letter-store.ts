import type { IrisPersistenceDeadLetterConfig } from "../../../types/source-options";
import type { IDeadLetterStore } from "../../../interfaces/IrisDeadLetterStore";
import { MemoryDeadLetterStore } from "../MemoryDeadLetterStore";
import { RedisDeadLetterStore } from "../RedisDeadLetterStore";

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
    } catch (cause) {
      throw new Error(`Failed to connect dead letter store to Redis at ${config.url}`, {
        cause,
      });
    }

    return new RedisDeadLetterStore(client, { ownedClient: true });
  }

  throw new Error(
    `Unknown dead letter store type: ${(config as Record<string, string>).type}`,
  );
};
