import { IRedisSource } from "@lindorm/redis";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { IKafkaDelayEnvelope, IKafkaDelayStore } from "../../interfaces";
import { KafkaDelayOptions } from "../../types";

export class DelayRedis implements IKafkaDelayStore {
  private readonly redis: Redis;

  public constructor(redis: IRedisSource) {
    this.redis = redis.client;
  }

  // public

  public async add(envelope: KafkaDelayOptions): Promise<void> {
    const timestamp = Date.now() + envelope.delay;
    const key = this.getZSetKey(envelope.topic);

    const entry = JSON.stringify({
      id: randomUUID(),
      key: envelope.key ?? null,
      topic: envelope.topic,
      value: envelope.value.toString("base64"),
      timestamp,
    });

    await this.redis.zadd(key, timestamp, entry);
  }

  public async get(topic: string): Promise<Array<IKafkaDelayEnvelope>> {
    const now = Date.now();
    const key = this.getZSetKey(topic);

    const entries = await this.redis.zrangebyscore(key, 0, now);
    const envelopes: Array<IKafkaDelayEnvelope> = [];

    for (const entry of entries) {
      const parsed = JSON.parse(entry);
      envelopes.push({
        ...parsed,
        value: Buffer.from(parsed.value, "base64"),
      });
    }

    return envelopes;
  }

  public async ack(id: string): Promise<void> {
    const keys = await this.redis.keys("delay:*");

    for (const key of keys) {
      const entries = await this.redis.zrange(key, 0, -1);

      for (const entry of entries) {
        try {
          const parsed = JSON.parse(entry);

          if (parsed.id === id) {
            await this.redis.zrem(key, entry);
            return;
          }
        } catch {
          continue;
        }
      }
    }
  }

  public async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  // private

  private getZSetKey(topic: string): string {
    return `delay:${topic}`;
  }
}
