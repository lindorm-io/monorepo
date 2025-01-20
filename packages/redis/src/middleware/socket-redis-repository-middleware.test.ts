import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockRedisSource } from "../mocks";
import { createSocketRedisRepositoryMiddleware } from "./socket-redis-repository-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createSocketRedisRepositoryMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      sources: {
        redis: createMockRedisSource(),
      },
    };
  });

  test("should find repository and set on context", async () => {
    await expect(
      createSocketRedisRepositoryMiddleware([TestEntity])(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.repositories.redis.testEntityRepository).toBeDefined();
  });
});
