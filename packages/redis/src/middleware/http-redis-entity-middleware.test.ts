import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockRedisRepository, createMockRedisSource } from "../mocks";
import { createHttpRedisEntityMiddleware } from "./http-redis-entity-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpRedisEntityMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "43b6fb29-3b2c-53d9-a238-0a6262e02c86",
        name: "name",
        email: "email@email.com",
        other: "other",
      },
      logger: createMockLogger(),
      sources: {
        redis: createMockRedisSource(),
      },
    };
  });

  test("should find entity and set on context", async () => {
    await expect(
      createHttpRedisEntityMiddleware(TestEntity)("data.id")(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toEqual({
      id: expect.any(String),
      createdAt: MockedDate,
      deletedAt: null,
      email: null,
      expiresAt: null,
      name: null,
      seq: null,
      updatedAt: MockedDate,
      version: 0,
    });
  });

  test("should find entity based on object path", async () => {
    const repo = createMockRedisRepository(TestEntity);
    ctx.sources.redis.repository.mockReturnValue(repo);

    await expect(
      createHttpRedisEntityMiddleware(TestEntity)({
        name: "data.name",
        email: "data.email",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toEqual(
      expect.objectContaining({
        name: "name",
        email: "email@email.com",
      }),
    );
  });

  test("should skip optional key value", async () => {
    await expect(
      createHttpRedisEntityMiddleware(TestEntity)("data.invalid", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should skip optional entity", async () => {
    const repo = createMockRedisRepository(TestEntity);
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.redis.repository.mockReturnValue(repo);

    await expect(
      createHttpRedisEntityMiddleware(TestEntity)("data.id", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should throw on mandatory key value", async () => {
    await expect(
      createHttpRedisEntityMiddleware(TestEntity)("data.invalid", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });

  test("should throw on mandatory entity", async () => {
    const repo = createMockRedisRepository(TestEntity);
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.redis.repository.mockReturnValue(repo);

    await expect(
      createHttpRedisEntityMiddleware(TestEntity)("data.id", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });
});
