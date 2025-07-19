import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { findEntity as _findEntity } from "../../utils/private";
import { createSocketEntityMiddleware } from "./socket-entity-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("../../utils/private");

const findEntity = _findEntity as jest.Mock;

describe("createSocketEntityMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "43b6fb29-3b2c-53d9-a238-0a6262e02c86",
        name: "name",
        email: "email@email.com",
        other: "other",
      },
      entities: {},
      logger: createMockLogger(),
    };

    findEntity.mockResolvedValue("FIND_ENTITY");
  });

  test("should find entity and set on context", async () => {
    await expect(
      createSocketEntityMiddleware(TestEntityOne, source)("data.id")(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntityOne).toEqual("FIND_ENTITY");
  });

  test("should skip optional entity", async () => {
    findEntity.mockResolvedValue(null);

    await expect(
      createSocketEntityMiddleware(TestEntityOne, source)("data.id", {
        mandatory: false,
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.entities.testEntityOne).toBeUndefined();
  });

  test("should throw on mandatory entity", async () => {
    findEntity.mockResolvedValue(null);

    await expect(
      createSocketEntityMiddleware(TestEntityOne, source)("data.id", { mandatory: true })(
        ctx,
        next,
      ),
    ).rejects.toThrow();
  });
});
