import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockMongoRepository, createMockMongoSource } from "../mocks";
import { createHttpMongoEntityMiddleware } from "./http-mongo-entity-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpMongoEntityMiddleware", () => {
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
        mongo: createMockMongoSource(),
      },
    };
  });

  test("should find entity and set on context", async () => {
    await expect(
      createHttpMongoEntityMiddleware(TestEntity)("data.id")(ctx, next),
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
    const repo = createMockMongoRepository(TestEntity);
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createHttpMongoEntityMiddleware(TestEntity)({
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
      createHttpMongoEntityMiddleware(TestEntity)("data.invalid", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should skip optional entity", async () => {
    const repo = createMockMongoRepository(TestEntity);
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createHttpMongoEntityMiddleware(TestEntity)("data.id", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should throw on mandatory key value", async () => {
    await expect(
      createHttpMongoEntityMiddleware(TestEntity)("data.invalid", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });

  test("should throw on mandatory entity", async () => {
    const repo = createMockMongoRepository(TestEntity);
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createHttpMongoEntityMiddleware(TestEntity)("data.id", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });
});
