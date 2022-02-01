import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Metric } from "@lindorm-io/koa";
import { cacheEntityMiddleware } from "./cache-entity-middleware";
import { logger, TestCache, TestEntity } from "../test";
import { CustomValidation } from "../types";

const next = () => Promise.resolve();

describe("cacheMiddleware", () => {
  let middlewareOptions: any;
  let options: any;
  let ctx: any;
  let path: string;

  beforeEach(() => {
    middlewareOptions = {};
    options = {};
    ctx = {
      cache: {
        testCache: {
          find: jest.fn().mockResolvedValue(new TestEntity({})),
        },
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
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should set entity on context and verify with custom validation callback", async () => {
    const customValidataion: CustomValidation = async (context, entity) => {
      if (!entity) {
        throw new Error("message");
        console.log(context);
      }
    };
    options.customValidation = customValidataion;

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should find cache on context with options key", async () => {
    middlewareOptions.cacheKey = "cacheKey";

    ctx.cache.cacheKey = { find: async () => new TestEntity({}) };

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    middlewareOptions.entityKey = "entityKey";

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.entityKey).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    options.attributeKey = "attributeKey";

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.cache.testCache.find).toHaveBeenCalledWith({ attributeKey: "identifier" });
  });

  test("should succeed when identifier is optional", async () => {
    options.optional = true;
    ctx.request.body.identifier = undefined;

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toBeUndefined();
  });

  test("should throw ClientError when identifier is missing", async () => {
    ctx.request.body.identifier = undefined;

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError when entity is missing", async () => {
    ctx.cache.testCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError with custom validation callback", async () => {
    const customValidataion: CustomValidation = async (context, entity) => {
      if (entity) {
        throw new Error("message");
        console.log(context);
      }
    };
    options.customValidation = customValidataion;

    await expect(
      cacheEntityMiddleware(TestEntity, TestCache, middlewareOptions)(path, options)(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
