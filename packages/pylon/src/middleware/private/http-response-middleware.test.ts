import MockDate from "mockdate";
import { httpResponseMiddleware } from "./http-response-middleware";

MockDate.set("2024-01-01T10:00:00.000Z");

describe("httpResponseMiddleware", () => {
  const array = ["array"];
  const date = new Date("2020-01-01T08:00:00.000Z");
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
      set: jest.fn(),
    };
  });

  test("should calculate response time and set on header", async () => {
    const next = async () => {
      MockDate.set("2024-01-01T10:01:23.456Z");
    };

    await expect(httpResponseMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("Date", "Mon, 01 Jan 2024 10:01:23 GMT");
    expect(ctx.set).toHaveBeenCalledWith("X-Start-Time", "1704103200000");
    expect(ctx.set).toHaveBeenCalledWith("X-Current-Time", "1704103283456");
    expect(ctx.set).toHaveBeenCalledWith("X-Response-Time", "83456ms");
  });

  test("should transform response body", async () => {
    await expect(httpResponseMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

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

  test("should not transform response body when undefined", async () => {
    ctx.body = undefined;

    await expect(httpResponseMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
  });

  test("should not transform response body when string", async () => {
    ctx.body = "string";

    await expect(httpResponseMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual("string");
  });
});
