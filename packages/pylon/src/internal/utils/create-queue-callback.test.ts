import { createMockKafkaMessageBus, createMockKafkaSource } from "@lindorm/kafka";
import { createMockMnemosRepository, createMockMnemosSource } from "@lindorm/mnemos";
import { createMockMongoSource } from "@lindorm/mongo";
import { createMockRabbitSource } from "@lindorm/rabbit";
import { createMockRedisSource } from "@lindorm/redis";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { TestMessageOne } from "../../__fixtures__/messages/test-message-one";
import { createQueueCallback } from "./create-queue-callback";

describe("createQueueCallback", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      kafka: { source: createMockKafkaSource() },
      mnemos: { source: createMockMnemosSource() },
      mongo: { source: createMockMongoSource() },
      rabbit: { source: createMockRabbitSource() },
      redis: { source: createMockRedisSource() },
    };
  });

  test("should resolve custom callback", async () => {
    const custom = jest.fn();

    const callback = createQueueCallback({ use: "custom", custom });

    expect(callback).toBe(custom);
  });

  test("should resolve message callback", async () => {
    const bus = createMockKafkaMessageBus(TestMessageOne);

    ctx.kafka.source.messageBus.mockReturnValue(bus);

    const callback = createQueueCallback({
      use: "message",
      source: "KafkaSource",
      handlers: {},
    });

    expect(callback).toBeDefined();

    await expect(
      callback!(ctx, "testEvent", { payload: true }, "background"),
    ).resolves.toBeUndefined();

    expect(bus.publish).toHaveBeenCalledWith({
      event: "testEvent",
      payload: { payload: true },
      priority: 1,
    });
  });

  test("should resolve entity callback", async () => {
    const repo = createMockMnemosRepository(TestEntityOne);

    ctx.mnemos.source.repository.mockReturnValue(repo);

    const callback = createQueueCallback({
      use: "entity",
      source: "MnemosSource",
      handlers: {},
    });

    expect(callback).toBeDefined();

    await expect(
      callback!(ctx, "testEvent", { payload: true }, "background"),
    ).resolves.toBeUndefined();

    expect(repo.insert).toHaveBeenCalledWith({
      event: "testEvent",
      payload: { payload: true },
      priority: 1,
    });
  });
});
