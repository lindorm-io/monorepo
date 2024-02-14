import MockDate from "mockdate";
import { responseDataMiddleware } from "./response-data-middleware";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("dataHandlingMiddleware", () => {
  const array = ["array"];
  const date = new Date("2020-01-01T08:00:00.000Z");
  const error = new Error("error");
  const string = "string";

  let ctx: any;

  beforeEach(() => {
    ctx = {
      config: {
        transformMode: "snake",
      },
      body: {
        PascalCaseTwo: "PascalCaseTwo",
        camelCaseTwo: "camelCaseTwo",
        snake_case_two: "snake_case_two",
        array,
        date,
        error,
        string,
      },
    };
  });

  test("should transform all outgoing body to snake_case", async () => {
    await expect(responseDataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({
      array: ["array"],
      camel_case_two: "camelCaseTwo",
      date: date,
      error: error,
      pascal_case_two: "PascalCaseTwo",
      snake_case_two: "snake_case_two",
      string: "string",
    });
  });

  test("should not fail if data is undefined", async () => {
    ctx = { body: undefined };

    await expect(responseDataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
  });

  test("should not convert response body when not object", async () => {
    ctx = { body: "string" };

    await expect(responseDataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toBe("string");
  });
});
