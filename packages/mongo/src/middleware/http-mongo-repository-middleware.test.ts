import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockMongoSource } from "../mocks";
import { createHttpMongoRepositoryMiddleware } from "./http-mongo-repository-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpMongoRepositoryMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      sources: {
        mongo: createMockMongoSource(),
      },
    };
  });

  test("should find repository and set on context", async () => {
    await expect(
      createHttpMongoRepositoryMiddleware([TestEntity])(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.repositories.mongo.testEntityRepository).toBeDefined();
  });
});
