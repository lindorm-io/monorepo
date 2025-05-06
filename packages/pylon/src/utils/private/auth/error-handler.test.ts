import { errorHandler } from "./error-handler";

describe("errorHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      query: {
        test: "test",
      },
    };
  });

  test("should resolve", async () => {
    await expect(errorHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual(ctx.query);
    expect(ctx.status).toBe(500);
  });
});
