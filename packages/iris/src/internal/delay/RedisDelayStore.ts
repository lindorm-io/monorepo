import type { IDelayStore } from "../../interfaces/IrisDelayStore.js";
import type { DelayedEntry } from "../../types/delay.js";
import { checkPipelineResults } from "../utils/check-pipeline-results.js";
import {
  deserializeDelayedEntry,
  serializeDelayedEntry,
} from "./utils/serialize-helpers.js";

const POLL_SCRIPT = `
local zsetKey = KEYS[1]
local hashKey = KEYS[2]
local now = tonumber(ARGV[1])

local ids = redis.call('ZRANGEBYSCORE', zsetKey, '-inf', now)
if #ids == 0 then
  return {}
end

redis.call('ZREMRANGEBYSCORE', zsetKey, '-inf', now)

local results = {}
for i, id in ipairs(ids) do
  local data = redis.call('HGET', hashKey, id)
  if data then
    redis.call('HDEL', hashKey, id)
    results[#results + 1] = data
  end
end

return results
`;

export class RedisDelayStore implements IDelayStore {
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
    const prefix = options?.keyPrefix ?? "iris:delay";
    this.zsetKey = prefix;
    this.hashKey = `${prefix}:data`;

    this.client.defineCommand("irisDelayPoll", {
      numberOfKeys: 2,
      lua: POLL_SCRIPT,
    });
  }

  public async schedule(entry: DelayedEntry): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.zadd(this.zsetKey, entry.deliverAt, entry.id);
    pipeline.hset(this.hashKey, entry.id, serializeDelayedEntry(entry));
    checkPipelineResults(await pipeline.exec());
  }

  public async poll(now: number): Promise<Array<DelayedEntry>> {
    const results: Array<string> = await this.client.irisDelayPoll(
      this.zsetKey,
      this.hashKey,
      now,
    );

    return results.map(deserializeDelayedEntry);
  }

  public async cancel(id: string): Promise<boolean> {
    const pipeline = this.client.pipeline();
    pipeline.zrem(this.zsetKey, id);
    pipeline.hdel(this.hashKey, id);
    const results = await pipeline.exec();
    checkPipelineResults(results);

    // zrem returns the number of removed members
    return results![0][1] === 1;
  }

  public async size(): Promise<number> {
    return this.client.zcard(this.zsetKey);
  }

  public async clear(): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.del(this.zsetKey);
    pipeline.del(this.hashKey);
    checkPipelineResults(await pipeline.exec());
  }

  public async close(): Promise<void> {
    if (this.ownedClient) {
      await this.client.quit();
    }
  }
}
