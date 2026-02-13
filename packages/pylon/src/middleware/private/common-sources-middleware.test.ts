import { createMockKafkaSource } from "@lindorm/kafka";
import { createMockLogger } from "@lindorm/logger";
import { createMockMnemosSource } from "@lindorm/mnemos";
import { createMockMongoSource } from "@lindorm/mongo";
import { createMockRabbitSource } from "@lindorm/rabbit";
import { createMockRedisSource } from "@lindorm/redis";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../../__fixtures__/entities/test-entity-two";
import { TestMessageOne } from "../../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../../__fixtures__/messages/test-message-two";
import { createSourcesMiddleware } from "./common-sources-middleware";

describe("createSourcesMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
  });

  test("should add sources to context", async () => {
    await expect(
      createSourcesMiddleware({
        entities: [TestEntityOne, TestEntityTwo],
        messages: [TestMessageOne, TestMessageTwo],
        sources: [
          createMockKafkaSource(),
          createMockMnemosSource(),
          createMockMongoSource(),
          createMockRabbitSource(),
          createMockRedisSource(),
        ],
      })(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.kafka.source).toBeDefined();
    expect(ctx.kafka.publishers.testMessageOnePublisher).toBeDefined();
    expect(ctx.kafka.publishers.testMessageTwoPublisher).toBeDefined();

    expect(ctx.mnemos.source).toBeDefined();
    expect(ctx.mnemos.repositories.testEntityOneRepository).toBeDefined();
    expect(ctx.mnemos.repositories.testEntityTwoRepository).toBeDefined();

    expect(ctx.mongo.source).toBeDefined();
    expect(ctx.mongo.repositories.testEntityOneRepository).toBeDefined();
    expect(ctx.mongo.repositories.testEntityTwoRepository).toBeDefined();

    expect(ctx.rabbit.source).toBeDefined();
    expect(ctx.rabbit.publishers.testMessageOnePublisher).toBeDefined();
    expect(ctx.rabbit.publishers.testMessageTwoPublisher).toBeDefined();

    expect(ctx.redis.source).toBeDefined();
    expect(ctx.redis.repositories.testEntityOneRepository).toBeDefined();
    expect(ctx.redis.repositories.testEntityTwoRepository).toBeDefined();
    expect(ctx.redis.publishers.testMessageOnePublisher).toBeDefined();
    expect(ctx.redis.publishers.testMessageTwoPublisher).toBeDefined();
  });
});
