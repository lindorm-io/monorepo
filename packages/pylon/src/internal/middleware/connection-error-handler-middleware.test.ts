import { ClientError, ServerError } from "@lindorm/errors";
import { connectionErrorHandlerMiddleware } from "./connection-error-handler-middleware";

describe("connectionErrorHandlerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
      },
    };
  });

  test("should pass through on success", async () => {
    await expect(
      connectionErrorHandlerMiddleware(ctx, jest.fn()),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).not.toHaveBeenCalled();
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  test("should log and rethrow client errors", async () => {
    const err = new ClientError("forbidden", {
      status: ClientError.Status.Forbidden,
    });
    const next = jest.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
    expect(ctx.logger.warn).toHaveBeenCalledWith("Connection client error", err);
  });

  test("should log and rethrow server errors", async () => {
    const err = new ServerError("boom");
    const next = jest.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
    expect(ctx.logger.error).toHaveBeenCalledWith("Connection server error", err);
  });

  test("should tolerate missing logger", async () => {
    delete ctx.logger;
    const err = new ClientError("nope");
    const next = jest.fn().mockRejectedValue(err);

    await expect(connectionErrorHandlerMiddleware(ctx, next)).rejects.toBe(err);
  });
});
