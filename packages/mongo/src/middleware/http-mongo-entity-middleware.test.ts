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
      id: "43b6fb29-3b2c-53d9-a238-0a6262e02c86",
      rev: 0,
      seq: 0,
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: undefined,
    });
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
    const repo = createMockMongoRepository(() => new TestEntity({ name: "name" }));
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
    const repo = createMockMongoRepository(() => new TestEntity({ name: "name" }));
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
