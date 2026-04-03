import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { eventErrorHandlerMiddleware } from "./event-error-handler-middleware";

describe("eventErrorHandlerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      socket: {
        emit: jest.fn(),
      },
    };
  });

  test("should do nothing when no errors are thrown", async () => {
    await expect(eventErrorHandlerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.socket.emit).not.toHaveBeenCalled();
  });

  test("should handle thrown errors", async () => {
    const next = () => Promise.reject(new Error("error message"));

    await expect(eventErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.socket.emit).toHaveBeenCalledWith("error", {
      code: "unknown_error",
      data: {},
      message: "error message",
      name: "Error",
      title: "Error",
    });

    expect(ctx.logger.error).toHaveBeenCalled();
  });

  test("should handle thrown server errors", async () => {
    const next = () =>
      Promise.reject(
        new ServerError("server error message", {
          code: "custom_error_code",
          data: { value: "data" },
          debug: { value: "debug", notes: "notes" },
          status: ServerError.Status.LoopDetected,
          title: "custom error title",
        }),
      );

    await expect(eventErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.socket.emit).toHaveBeenCalledWith("error", {
      code: "custom_error_code",
      data: { value: "data" },
      message: "server error message",
      name: "ServerError",
      title: "custom error title",
    });

    expect(ctx.logger.error).toHaveBeenCalled();
  });

  test("should handle thrown client errors", async () => {
    const next = () =>
      Promise.reject(
        new ClientError("client error message", {
          code: "custom_error_code",
          data: { value: "data" },
          debug: { value: "debug", notes: "notes" },
          status: ClientError.Status.ImATeapot,
          title: "custom error title",
        }),
      );

    await expect(eventErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.socket.emit).toHaveBeenCalledWith("error", {
      code: "custom_error_code",
      data: { value: "data" },
      message: "client error message",
      name: "ClientError",
      title: "custom error title",
    });

    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  test("should handle exceptions", async () => {
    const next = () => Promise.reject(new Error("error message"));

    ctx.logger.error.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

    await expect(eventErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.socket.emit).toHaveBeenCalledWith("error", {
      code: "unexpected_exception",
      data: {},
      message: "An unexpected exception occurred while handling thrown error",
      name: "UnexpectedException",
      title: "Unexpected Exception",
    });
  });
});
