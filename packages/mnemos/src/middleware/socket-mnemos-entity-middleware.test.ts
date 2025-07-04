import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntity } from "../__fixtures__/test-entity";
import { createMockMnemosRepository, createMockMnemosSource } from "../mocks";
import { createSocketMnemosEntityMiddleware } from "./socket-mnemos-entity-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createSocketMnemosEntityMiddleware", () => {
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
        mnemos: createMockMnemosSource(),
      },
    };
  });

  test("should find entity and set on context", async () => {
    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)("data.id")(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeInstanceOf(TestEntity);
  });

  test("should find entity based on object path", async () => {
    const repo = createMockMnemosRepository(TestEntity);
    ctx.sources.mnemos.repository.mockReturnValue(repo);

    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)({
        name: "data.name",
        email: "data.email",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeInstanceOf(TestEntity);
  });

  test("should skip optional key value", async () => {
    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)("data.invalid", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should skip optional entity", async () => {
    const repo = createMockMnemosRepository(TestEntity);
    repo.findOne = jest.fn().mockReturnValue(null);
    ctx.sources.mnemos.repository.mockReturnValue(repo);

    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)("data.id", { optional: true })(
        ctx,
        next,
      ),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntity).toBeUndefined();
  });

  test("should throw on mandatory key value", async () => {
    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)("data.invalid", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });

  test("should throw on mandatory entity", async () => {
    const repo = createMockMnemosRepository(TestEntity);
    repo.findOne = jest.fn().mockReturnValue(null);
    ctx.sources.mnemos.repository.mockReturnValue(repo);

    await expect(
      createSocketMnemosEntityMiddleware(TestEntity)("data.id", { optional: false })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });
});
