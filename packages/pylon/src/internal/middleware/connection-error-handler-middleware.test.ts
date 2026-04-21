import { ClientError, ServerError } from "@lindorm/errors";
import { connectionErrorHandlerMiddleware } from "./connection-error-handler-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("connectionErrorHandlerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
      },
    };
  });

  test("should pass through on success", async () => {
    await expect(connectionErrorHandlerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();
    expect(ctx.logger.error).not.toHaveBeenCalled();
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  test("should log and rethrow client errors", async () => {
    const err = new ClientError("forbidden", {
      status: ClientError.Status.Forbidden,
    });
    const next = vi.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
    expect(ctx.logger.warn).toHaveBeenCalledWith("Connection client error", err);
  });

  test("should log and rethrow server errors", async () => {
    const err = new ServerError("boom");
    const next = vi.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
    expect(ctx.logger.error).toHaveBeenCalledWith("Connection server error", err);
  });

  test("should tolerate missing logger", async () => {
    delete ctx.logger;
    const err = new ClientError("nope");
    const next = vi.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
  });
});
