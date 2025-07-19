import { Entity, EntityBase } from "@lindorm/entity";
import { ServerError } from "@lindorm/errors";
import { createMockKafkaSource } from "@lindorm/kafka";
import { createMockLogger } from "@lindorm/logger";
import { createMockMnemosSource } from "@lindorm/mnemos";
import { createMockMongoSource } from "@lindorm/mongo";
import { createMockRabbitSource } from "@lindorm/rabbit";
import { createMockRedisSource } from "@lindorm/redis";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { findEntitySource } from "./find-entity-source";

describe("findEntitySource", () => {
  let ctx: any;
  let target: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      kafka: { source: createMockKafkaSource() },
      mnemos: { source: createMockMnemosSource() },
      mongo: { source: createMockMongoSource() },
      rabbit: { source: createMockRabbitSource() },
      redis: { source: createMockRedisSource() },
    };

    target = TestEntityOne;

    options = {
      source: "RedisSource",
    };
  });

  test("should resolve entity using string path", () => {
    expect(findEntitySource(ctx, target, options)).toEqual("RedisSource");
  });

  test("should resolve entity using primary source from metadata", () => {
    options.source = undefined;

    expect(findEntitySource(ctx, target, options)).toEqual("MnemosSource");
  });

  test("should resolve entity from source calculation", () => {
    options.source = undefined;

    @Entity()
    class TestEntity extends EntityBase {}

    ctx.mnemos.source.hasEntity.mockReturnValue(false);
    ctx.mongo.source.hasEntity.mockReturnValue(true);
    ctx.redis.source.hasEntity.mockReturnValue(false);

    expect(findEntitySource(ctx, TestEntity, options)).toEqual("MongoSource");
  });

  test("should throw on missing source calculation", () => {
    options.source = undefined;

    @Entity()
    class TestEntity extends EntityBase {}

    ctx.mnemos.source.hasEntity.mockReturnValue(false);
    ctx.mongo.source.hasEntity.mockReturnValue(false);
    ctx.redis.source.hasEntity.mockReturnValue(false);

    expect(() => findEntitySource(ctx, TestEntity, options)).toThrow(ServerError);
  });

  test("should throw on invalid source calculation", () => {
    options.source = undefined;

    @Entity()
    class TestEntity extends EntityBase {}

    ctx.mnemos.source.hasEntity.mockReturnValue(true);
    ctx.mongo.source.hasEntity.mockReturnValue(true);
    ctx.redis.source.hasEntity.mockReturnValue(true);

    expect(() => findEntitySource(ctx, TestEntity, options)).toThrow(ServerError);
  });
});
