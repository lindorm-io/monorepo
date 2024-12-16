import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { httpErrorHandlerMiddleware } from "./http-error-handler-middleware";

describe("httpErrorHandlerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      body: undefined,
      status: 204,
      logger: createMockLogger(),
    };
  });

  afterEach(jest.clearAllMocks);

  test("should do nothing when no errors are thrown", async () => {
    await expect(httpErrorHandlerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.status).toEqual(204);
    expect(ctx.body).toBeUndefined();
  });

  test("should handle thrown errors", async () => {
    const next = () => Promise.reject(new Error("error message"));

    await expect(httpErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toEqual(500);
    expect(ctx.body).toEqual({
      error: {
        id: expect.any(String),
        code: "unknown_error",
        data: {},
        message: "error message",
        name: "Error",
        support: expect.any(String),
        title: "Error",
      },
      server: "Pylon",
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

    await expect(httpErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toEqual(508);
    expect(ctx.body).toEqual({
      error: {
        id: expect.any(String),
        code: "custom_error_code",
        data: { value: "data" },
        message: "server error message",
        name: "ServerError",
        support: expect.any(String),
        title: "custom error title",
      },
      server: "Pylon",
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

    await expect(httpErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toEqual(418);
    expect(ctx.body).toEqual({
      error: {
        id: expect.any(String),
        code: "custom_error_code",
        data: { value: "data" },
        message: "client error message",
        name: "ClientError",
        support: expect.any(String),
        title: "custom error title",
      },
      server: "Pylon",
    });

    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  test("should handle exceptions", async () => {
    const next = () => Promise.reject(new Error("error message"));

    ctx.logger.error.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

    await expect(httpErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toEqual(500);
    expect(ctx.body).toEqual({
      error: {
        id: expect.any(String),
        code: "unexpected_exception",
        data: {},
        message: "An unexpected exception occurred while handling thrown error",
        name: "UnexpectedException",
        support: expect.any(String),
        title: "Unexpected Exception",
      },
      server: "Pylon",
    });
  });
});
