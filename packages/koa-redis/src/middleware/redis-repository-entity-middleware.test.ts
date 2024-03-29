import { CachedEntityCustomValidation } from "../types";
import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError, TestEntity } from "@lindorm-io/entity";
import { Metric } from "@lindorm-io/koa";
import { redisRepositoryEntityMiddleware } from "./redis-repository-entity-middleware";
import { createMockRedisRepository, TestRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/core-logger";

const next = () => Promise.resolve();

describe("cacheMiddleware", () => {
  let middlewareOptions: any;
  let options: any;
  let ctx: any;
  let path: string;

  const logger = createMockLogger();

  beforeEach(() => {
    middlewareOptions = {};
    options = {};
    ctx = {
      redis: {
        testRedisRepository: createMockRedisRepository(),
      },
      entity: {},
      logger,
      metrics: {},
      request: { body: { identifier: "identifier" } },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);

    path = "request.body.identifier";
  });

  test("should set entity on context", async () => {
    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should set entity on context and verify with custom validation callback", async () => {
    const customValidation: CachedEntityCustomValidation = async (context, entity) => {
      if (!entity) {
        throw new Error("message");
      }
    };
    options.customValidation = customValidation;

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should find cache on context with options key", async () => {
    middlewareOptions.cacheKey = "cacheKey";

    ctx.redis.cacheKey = { find: async () => new TestEntity({}) };

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    middlewareOptions.entityKey = "entityKey";

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.entityKey).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    options.attributeKey = "attributeKey";

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.redis.testRedisRepository.find).toHaveBeenCalledWith({ attributeKey: "identifier" });
  });

  test("should succeed when identifier is optional", async () => {
    options.optional = true;
    ctx.request.body.identifier = undefined;

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toBeUndefined();
  });

  test("should throw ClientError when identifier is missing", async () => {
    ctx.request.body.identifier = undefined;

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError when entity is missing", async () => {
    ctx.redis.testRedisRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError with custom validation callback", async () => {
    const customValidation: CachedEntityCustomValidation = async (context, entity) => {
      if (entity) {
        throw new Error("message");
      }
    };
    options.customValidation = customValidation;

    await expect(
      redisRepositoryEntityMiddleware(
        TestEntity,
        TestRedisRepository,
        middlewareOptions,
      )(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
