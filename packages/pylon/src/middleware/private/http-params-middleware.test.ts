import { httpParamsMiddleware } from "./http-params-middleware";

describe("httpParamsMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { existingValue: 1 },
      params: {
        snake_case_param: "value",
      },
    };
  });

  test("should resolve", async () => {
    await expect(httpParamsMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      existingValue: 1,
      snakeCaseParam: "value",
    });
  });
});
