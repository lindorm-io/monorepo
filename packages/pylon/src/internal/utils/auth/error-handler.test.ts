import { errorHandler } from "./error-handler";

describe("errorHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      query: {
        error: "access_denied",
        error_description: "User cancelled",
        state: "abc123",
      },
    };
  });

  test("should resolve with OIDC error fields", async () => {
    await expect(errorHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      error: "access_denied",
      error_description: "User cancelled",
      state: "abc123",
    });
    expect(ctx.status).toBe(400);
  });

  test("should resolve with defaults when query is empty", async () => {
    ctx.query = {};

    await expect(errorHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      error: "unknown_error",
      error_description: null,
      state: null,
    });
    expect(ctx.status).toBe(400);
  });
});
