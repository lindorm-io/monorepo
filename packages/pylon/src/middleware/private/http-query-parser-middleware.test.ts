import { httpQueryParserMiddleware } from "./http-query-parser-middleware";

describe("httpQueryParserMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { existingValue: 1 },
      query: {
        snake_case_bool_false: "false",
        snake_case_bool_true: "true",
        snake_case_iso_date_offset: "2021-01-01T00:00:00.000+00:00",
        snake_case_iso_date_zulu: "2021-01-01T00:00:00.000Z",
        snake_case_null: "null",
        snake_case_number: "1",
        snake_case_string: "value",
        snake_case_undefined: "undefined",
      },
    };
  });

  test("should resolve", async () => {
    await expect(httpQueryParserMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      existingValue: 1,
      snakeCaseBoolFalse: false,
      snakeCaseBoolTrue: true,
      snakeCaseIsoDateOffset: new Date("2021-01-01T00:00:00.000Z"),
      snakeCaseIsoDateZulu: new Date("2021-01-01T00:00:00.000Z"),
      snakeCaseNull: null,
      snakeCaseNumber: 1,
      snakeCaseString: "value",
      snakeCaseUndefined: undefined,
    });
  });

  test("should resolve with empty query", async () => {
    ctx.query = null;

    await expect(httpQueryParserMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      existingValue: 1,
    });
  });
});
