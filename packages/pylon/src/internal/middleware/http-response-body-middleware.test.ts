import MockDate from "mockdate";
import Stream, { Readable } from "stream";
import { httpResponseBodyMiddleware } from "./http-response-body-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("httpResponseBodyMiddleware", () => {
  const array = ["array"];
  const date = MockedDate;
  const error = new Error("error");
  const string = "string";

  let ctx: any;

  beforeEach(() => {
    ctx = {
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

  test("should transform response body when object", async () => {
    await expect(httpResponseBodyMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      array: ["array"],
      camel_case_two: "camelCaseTwo",
      date: date,
      error: error,
      pascal_case_two: "PascalCaseTwo",
      snake_case_two: "snake_case_two",
      string: "string",
    });
  });

  test("should transform response body when array", async () => {
    ctx.body = [{ String: "string" }];

    await expect(httpResponseBodyMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual([{ string: "string" }]);
  });

  test("should not transform response body when stream", async () => {
    ctx.body = Readable.from("string");

    await expect(httpResponseBodyMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual(expect.any(Stream));
  });

  test("should not transform response body when undefined", async () => {
    ctx.body = undefined;

    await expect(httpResponseBodyMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
  });

  test("should not transform response body when string", async () => {
    ctx.body = "string";

    await expect(httpResponseBodyMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual("string");
  });
});
