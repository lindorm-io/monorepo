import { createMockKafkaMessageBus, createMockKafkaSource } from "@lindorm/kafka";
import { createMockMnemosRepository, createMockMnemosSource } from "@lindorm/mnemos";
import { createMockMongoSource } from "@lindorm/mongo";
import { createMockRabbitSource } from "@lindorm/rabbit";
import { createMockRedisSource } from "@lindorm/redis";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { TestMessageOne } from "../../__fixtures__/messages/test-message-one";
import { createWebhookCallback } from "./create-webhook-callback";

describe("createWebhookCallback", () => {
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

    const callback = createWebhookCallback({ use: "custom", custom });

    expect(callback).toBe(custom);
  });

  test("should resolve message callback", async () => {
    const bus = createMockKafkaMessageBus(TestMessageOne);

    ctx.kafka.source.messageBus.mockReturnValue(bus);

    const callback = createWebhookCallback({
      use: "message",
      source: "KafkaSource",
      subscriptions: "MnemosSource",
    });

    expect(callback).toBeDefined();

    await expect(callback!(ctx, "testEvent", { payload: true })).resolves.toBeUndefined();

    expect(bus.publish).toHaveBeenCalledWith({
      event: "testEvent",
      payload: { payload: true },
    });
  });

  test("should resolve entity callback", async () => {
    const repo = createMockMnemosRepository(TestEntityOne);

    ctx.mnemos.source.repository.mockReturnValue(repo);

    const callback = createWebhookCallback({
      use: "entity",
      source: "MnemosSource",
      subscriptions: "MnemosSource",
    });

    expect(callback).toBeDefined();

    await expect(callback!(ctx, "testEvent", { payload: true })).resolves.toBeUndefined();

    expect(repo.insert).toHaveBeenCalledWith({
      event: "testEvent",
      payload: { payload: true },
    });
  });
});
