import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../types/dead-letter.js";
import { checkPipelineResults } from "../utils/check-pipeline-results.js";
import {
  deserializeDeadLetterEntry,
  serializeDeadLetterEntry,
} from "./utils/serialize-helpers.js";

export class RedisDeadLetterStore implements IDeadLetterStore {
  private readonly client: any;
  private readonly ownedClient: boolean;
  private readonly zsetKey: string;
  private readonly hashKey: string;

  public constructor(
    client: any,
    options?: { keyPrefix?: string; ownedClient?: boolean },
  ) {
    this.client = client;
    this.ownedClient = options?.ownedClient ?? false;
    const prefix = options?.keyPrefix ?? "iris:dlq";
    this.zsetKey = prefix;
    this.hashKey = `${prefix}:data`;
  }

  public async add(entry: DeadLetterEntry): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.zadd(this.zsetKey, entry.timestamp, entry.id);
    pipeline.hset(this.hashKey, entry.id, serializeDeadLetterEntry(entry));
    checkPipelineResults(await pipeline.exec());
  }

  public async list(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    // Get all IDs newest first
    const ids: Array<string> = await this.client.zrevrange(this.zsetKey, 0, -1);

    if (ids.length === 0) return [];

    const values: Array<string | null> = await this.client.hmget(this.hashKey, ...ids);

    let entries: Array<DeadLetterEntry> = [];
    for (const value of values) {
      if (value) {
        entries.push(deserializeDeadLetterEntry(value));
      }
    }

    if (options?.topic) {
      entries = entries.filter((e) => e.topic === options.topic);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? entries.length;

    return entries.slice(offset, offset + limit);
  }

  public async get(id: string): Promise<DeadLetterEntry | null> {
    const data = await this.client.hget(this.hashKey, id);
    if (!data) return null;
    return deserializeDeadLetterEntry(data);
  }

  public async remove(id: string): Promise<boolean> {
    const pipeline = this.client.pipeline();
    pipeline.zrem(this.zsetKey, id);
    pipeline.hdel(this.hashKey, id);
    const results = await pipeline.exec();
    checkPipelineResults(results);
    return results![0][1] === 1;
  }

  public async purge(options?: DeadLetterFilterOptions): Promise<number> {
    if (!options?.topic) {
      const count = await this.client.zcard(this.zsetKey);
      const pipeline = this.client.pipeline();
      pipeline.del(this.zsetKey);
      pipeline.del(this.hashKey);
      checkPipelineResults(await pipeline.exec());
      return count;
    }

    // Get all entries, filter by topic, remove matching
    const ids: Array<string> = await this.client.zrange(this.zsetKey, 0, -1);
    if (ids.length === 0) return 0;

    const values: Array<string | null> = await this.client.hmget(this.hashKey, ...ids);

    const toRemove: Array<string> = [];
    for (let i = 0; i < ids.length; i++) {
      if (values[i]) {
        const entry = deserializeDeadLetterEntry(values[i]!);
        if (entry.topic === options.topic) {
          toRemove.push(ids[i]);
        }
      }
    }

    if (toRemove.length === 0) return 0;

    const pipeline = this.client.pipeline();
    for (const id of toRemove) {
      pipeline.zrem(this.zsetKey, id);
      pipeline.hdel(this.hashKey, id);
    }
    checkPipelineResults(await pipeline.exec());

    return toRemove.length;
  }

  public async count(options?: DeadLetterFilterOptions): Promise<number> {
    if (!options?.topic) {
      return this.client.zcard(this.zsetKey);
    }

    const ids: Array<string> = await this.client.zrange(this.zsetKey, 0, -1);
    if (ids.length === 0) return 0;

    const values: Array<string | null> = await this.client.hmget(this.hashKey, ...ids);

    let count = 0;
    for (const value of values) {
      if (value) {
        const entry = deserializeDeadLetterEntry(value);
        if (entry.topic === options.topic) {
          count++;
        }
      }
    }

    return count;
  }

  public async close(): Promise<void> {
    if (this.ownedClient) {
      await this.client.quit();
    }
  }
}
