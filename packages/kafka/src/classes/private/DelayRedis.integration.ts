import { createMockLogger } from "@lindorm/logger";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { KafkaDelayOptions } from "../../types";
import { DelayRedis } from "./DelayRedis"; // adjust path if needed

describe("DelayRedis Integration", () => {
  let redis: IRedisSource;
  let store: DelayRedis;

  beforeEach(() => {
    redis = new RedisSource({
      logger: createMockLogger(),
      url: "redis://localhost:6379",
    });
    store = new DelayRedis(redis);
  });

  afterEach(async () => {
    await redis.client.flushdb();
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  const exampleEnvelope = (override?: Partial<KafkaDelayOptions>): KafkaDelayOptions => ({
    key: "test-key",
    topic: "test-topic",
    value: Buffer.from(JSON.stringify({ hello: "world" })),
    delay: 0,
    ...override,
  });

  test("should add and retrieve immediate message", async () => {
    const input = exampleEnvelope();

    await store.add(input);

    const result = await store.get(input.topic);

    expect(result).toHaveLength(1);

    const message = result[0];

    expect(message.topic).toBe(input.topic);
    expect(message.key).toBe(input.key);
    expect(message.value).toEqual(input.value);

    expect(typeof message.id).toBe("string");
    expect(typeof message.timestamp).toBe("number");
  });

  test("should not return delayed message before time", async () => {
    const input = exampleEnvelope({ delay: 999999 });

    await store.add(input);

    const result = await store.get(input.topic);

    expect(result).toHaveLength(0);
  });

  test("should return delayed message after waiting", async () => {
    const input = exampleEnvelope({ delay: 50 });

    await store.add(input);
    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = await store.get(input.topic);

    expect(result).toHaveLength(1);
    expect(result[0].value).toEqual(input.value);
  });

  test("should delete message after ack", async () => {
    const input = exampleEnvelope();
    await store.add(input);

    const [msg] = await store.get(input.topic);
    expect(msg).toBeDefined();

    await store.ack(msg.id);

    const resultAfterAck = await store.get(input.topic);
    expect(resultAfterAck).toHaveLength(0);
  });

  test("should isolate topics", async () => {
    await store.add(exampleEnvelope({ topic: "topic-A", delay: 0 }));
    await store.add(exampleEnvelope({ topic: "topic-B", delay: 0 }));

    const resultA = await store.get("topic-A");
    const resultB = await store.get("topic-B");

    expect(resultA).toHaveLength(1);
    expect(resultB).toHaveLength(1);
    expect(resultA[0].topic).toBe("topic-A");
    expect(resultB[0].topic).toBe("topic-B");
  });
});
