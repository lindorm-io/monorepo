import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import {
  createMockMongoEntityCallback,
  createMockMongoRepository,
  createMockMongoSource,
} from "../mocks";
import { createSocketMongoEntityMiddleware } from "./socket-mongo-entity-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createSocketMongoEntityMiddleware", () => {
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
      createSocketMongoEntityMiddleware(TestEntity)("data.id")(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toEqual({
      id: expect.any(String),
      rev: 0,
      seq: 0,
      createdAt: MockedDate,
      updatedAt: MockedDate,
      deletedAt: null,
      expiresAt: null,
      email: null,
      name: null,
    });
  });

  test("should find entity based on object path", async () => {
    const repo = createMockMongoRepository(createMockMongoEntityCallback(TestEntity));
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createSocketMongoEntityMiddleware(TestEntity)({
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
      createSocketMongoEntityMiddleware(TestEntity)("data.invalid", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should skip optional entity", async () => {
    const repo = createMockMongoRepository(createMockMongoEntityCallback(TestEntity));
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createSocketMongoEntityMiddleware(TestEntity)("data.id", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should throw on mandatory key value", async () => {
    await expect(
      createSocketMongoEntityMiddleware(TestEntity)("data.invalid", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });

  test("should throw on mandatory entity", async () => {
    const repo = createMockMongoRepository(createMockMongoEntityCallback(TestEntity));
    repo.findOne = jest.fn().mockResolvedValue(null);
    ctx.sources.mongo.repository.mockReturnValue(repo);

    await expect(
      createSocketMongoEntityMiddleware(TestEntity)("data.id", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });
});
