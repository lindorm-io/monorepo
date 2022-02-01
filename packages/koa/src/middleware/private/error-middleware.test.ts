import { RedirectError, ServerError } from "@lindorm-io/errors";
import { errorMiddleware } from "./error-middleware";

describe("errorMiddleware", () => {
  let ctx: any;
  let next: any;

  beforeEach(() => {
    ctx = {
      app: {
        emit: jest.fn(),
      },
      logger: {
        error: jest.fn(),
      },
      redirect: jest.fn(),
    };
    next = () =>
      Promise.reject(
        new ServerError("error-message", {
          code: "ERROR_CODE",
          data: { value: "data" },
          debug: { value: "debug", notes: "notes" },
          description: "description",
          statusCode: ServerError.StatusCode.LOOP_DETECTED,
          title: "title",
        }),
      );
  });

  test("should resolve with error data", async () => {
    await expect(errorMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toBe(508);
    expect(ctx.body).toStrictEqual({
      error: {
        code: "ERROR_CODE",
        data: { value: "data" },
        description: "description",
        message: "error-message",
        name: "ServerError",
        title: "title",
      },
    });
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  test("should redirect with error data", async () => {
    next = () =>
      Promise.reject(
        new RedirectError("error", {
          code: "error_code",
          description: "error_description",
          redirect: "https://test.lindorm.io/",
          state: "error_state",
          uri: "https://error.lindorm.io/error_code",
        }),
      );

    await expect(errorMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toBeUndefined();
    expect(ctx.body).toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.redirect).toHaveBeenCalledWith(
      "https://test.lindorm.io/?error=error_code&error_description=error_description&error_uri=https%3A%2F%2Ferror.lindorm.io%2Ferror_code&state=error_state",
    );
  });

  test("should resolve with default error data", async () => {
    next = () => Promise.reject(new ServerError("message"));

    await expect(errorMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toBe(500);
    expect(ctx.body).toStrictEqual({
      error: {
        code: null,
        data: {},
        description: null,
        message: "message",
        name: "ServerError",
        title: null,
      },
    });
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  test("should resolve even when something fails", async () => {
    ctx.logger.error.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

    await expect(errorMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toBe(500);
    expect(ctx.body).toStrictEqual({
      error: {
        name: "UnexpectedError",
        title: "Unexpected Error",
        message: "Something went wrong",
      },
    });
    expect(ctx.app.emit).toHaveBeenCalledWith("error", new Error("unexpected"));
  });
});
