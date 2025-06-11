import { ClientError } from "@lindorm/errors";
import MockDate from "mockdate";
import { createHttpDateValidationMiddleware } from "./http-date-validation-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpDateValidationMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      state: {
        metadata: {
          date: MockedDate,
        },
      },
    };

    options = {
      minRequestAge: "10s",
      maxRequestAge: "10s",
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpDateValidationMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });

  test("should throw error on invalid date (min)", async () => {
    ctx.state.metadata.date = new Date("2024-01-01T07:00:00.000Z");

    await expect(
      createHttpDateValidationMiddleware(options)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should return error on invalid date (max)", async () => {
    ctx.state.metadata.date = new Date("2024-01-01T09:00:00.000Z");

    await expect(
      createHttpDateValidationMiddleware(options)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });
});
