import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockElasticSource } from "../mocks";
import { createHttpElasticRepositoryMiddleware } from "./http-elastic-repository-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpElasticRepositoryMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      sources: {
        elastic: createMockElasticSource(),
      },
    };
  });

  test("should find repository and set on context", async () => {
    await expect(
      createHttpElasticRepositoryMiddleware([TestEntity])(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.repositories.elastic.testEntityRepository).toBeDefined();
  });
});
