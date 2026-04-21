import { errorHandler } from "./error-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

  test("should resolve with query params as body", async () => {
    await expect(errorHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      error: "access_denied",
      error_description: "User cancelled",
      state: "abc123",
    });
    expect(ctx.status).toBe(400);
  });

  test("should resolve with empty body when query is empty", async () => {
    ctx.query = {};

    await expect(errorHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({});
    expect(ctx.status).toBe(400);
  });
});
