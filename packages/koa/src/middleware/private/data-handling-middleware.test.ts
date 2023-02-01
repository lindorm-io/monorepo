import MockDate from "mockdate";
import { dataHandlingMiddleware } from "./data-handling-middleware";

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
      request: {
        body: {
          PascalCaseOne: "PascalCaseOne",
          camelCaseOne: "camelCaseOne",
          snake_case_one: "snake_case_one",
          array,
          date,
          error,
          string,
        },
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
      query: {
        PascalCaseThree: "PascalCaseThree",
        camelCaseThree: "camelCaseThree",
        snake_case_three: encodeURI("snake_case_three"),
        number: 123456,
        string: "string",
        queryUri: encodeURIComponent("https://test.lindorm.io/route/path"),
        queryWithSpaces: encodeURI("query with spaces"),
      },
    };
  });

  test("should transform and merge all incoming data into one object on context", async () => {
    await expect(dataHandlingMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.data).toStrictEqual({
      array: ["array"],
      camelCaseOne: "camelCaseOne",
      camelCaseThree: "camelCaseThree",
      date: date,
      error: error,
      number: "123456",
      pascalCaseOne: "PascalCaseOne",
      pascalCaseThree: "PascalCaseThree",
      queryUri: "https://test.lindorm.io/route/path",
      queryWithSpaces: "query with spaces",
      snakeCaseOne: "snake_case_one",
      snakeCaseThree: "snake_case_three",
      string: "string",
    });
  });

  test("should transform all outgoing body to snake_case", async () => {
    await expect(dataHandlingMiddleware(ctx, next)).resolves.toBeUndefined();

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
    ctx = { request: { body: undefined }, body: undefined };

    await expect(dataHandlingMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.data).toStrictEqual({});
    expect(ctx.body).toBeUndefined();
  });

  test("should not convert response body when not object", async () => {
    ctx = { query: "", request: { body: {} }, body: "string" };

    await expect(dataHandlingMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toBe("string");
  });
});
