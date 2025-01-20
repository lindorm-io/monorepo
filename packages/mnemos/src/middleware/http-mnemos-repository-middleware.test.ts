import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockMnemosSource } from "../mocks";
import { createHttpMnemosRepositoryMiddleware } from "./http-mnemos-repository-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpMnemosRepositoryMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      sources: {
        mnemos: createMockMnemosSource(),
      },
    };
  });

  test("should find repository and set on context", async () => {
    await expect(
      createHttpMnemosRepositoryMiddleware([TestEntity])(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.repositories.mnemos.testEntityRepository).toBeDefined();
  });
});
