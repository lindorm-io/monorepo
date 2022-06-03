import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Metric } from "@lindorm-io/koa";
import { TestEntity, TestRepository } from "../test";
import { repositoryEntityMiddleware } from "./repository-entity-middleware";
import { StoredEntityCustomValidation } from "../types";
import { createMockLogger } from "@lindorm-io/winston";

const next = () => Promise.resolve();

describe("repositoryEntityMiddleware", () => {
  let middlewareOptions: any;
  let options: any;
  let ctx: any;
  let path: string;

  const logger = createMockLogger();

  beforeEach(() => {
    middlewareOptions = {};
    options = {};
    ctx = {
      entity: {},
      logger,
      metrics: {},
      repository: {
        testRepository: {
          find: jest.fn().mockResolvedValue(new TestEntity({})),
        },
      },
      request: { body: { identifier: "identifier" } },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);

    path = "request.body.identifier";
  });

  test("should set entity on context", async () => {
    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should set entity on context and verify with custom validation callback", async () => {
    const customValidation: StoredEntityCustomValidation = async (context, entity) => {
      if (!entity) {
        throw new Error("message");
      }
    };
    options.customValidation = customValidation;

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.metrics.entity).toStrictEqual(expect.any(Number));
  });

  test("should find repository on context with options key", async () => {
    middlewareOptions.repositoryKey = "repositoryKey";

    ctx.repository.repositoryKey = { find: async () => new TestEntity({}) };

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    middlewareOptions.entityKey = "entityKey";

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.entityKey).toStrictEqual(expect.any(TestEntity));
  });

  test("should set entity on context with options key", async () => {
    options.attributeKey = "attributeKey";

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toStrictEqual(expect.any(TestEntity));
    expect(ctx.repository.testRepository.find).toHaveBeenCalledWith({
      attributeKey: "identifier",
    });
  });

  test("should succeed when identifier is optional", async () => {
    options.optional = true;
    ctx.request.body.identifier = undefined;

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.entity.testEntity).toBeUndefined();
  });

  test("should throw ClientError when identifier is missing", async () => {
    ctx.request.body.identifier = undefined;

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError when entity is missing", async () => {
    ctx.repository.testRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).rejects.toThrow(ClientError);
  });

  test("should throw ClientError with custom validation callback", async () => {
    const customValidation: StoredEntityCustomValidation = async (context, entity) => {
      if (entity) {
        throw new Error("message");
      }
    };
    options.customValidation = customValidation;

    await expect(
      repositoryEntityMiddleware(TestEntity, TestRepository, middlewareOptions)(path, options)(
        ctx,
        next,
      ),
    ).rejects.toThrow(ClientError);
  });
});
