import { ClientError, ServerError } from "@lindorm/errors";
import { RedirectError } from "../../errors";
import { httpErrorHandlerMiddleware } from "./http-error-handler-middleware";

describe("httpErrorHandlerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      body: undefined,
      state: {
        app: {
          environment: "test",
          name: "test_name",
          version: "0.0.0",
        },
      },
      status: 204,
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
      __meta: {
        app: "Pylon",
        environment: "test",
        name: "test_name",
        version: "0.0.0",
      },
      error: {
        id: expect.any(String),
        code: "unknown_error",
        data: {},
        message: "error message",
        name: "Error",
        support: expect.any(String),
        title: "Error",
      },
    });
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
      __meta: {
        app: "Pylon",
        environment: "test",
        name: "test_name",
        version: "0.0.0",
      },
      error: {
        id: expect.any(String),
        code: "custom_error_code",
        data: { value: "data" },
        message: "server error message",
        name: "ServerError",
        support: expect.any(String),
        title: "custom error title",
      },
    });
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
      __meta: {
        app: "Pylon",
        environment: "test",
        name: "test_name",
        version: "0.0.0",
      },
      error: {
        id: expect.any(String),
        code: "custom_error_code",
        data: { value: "data" },
        message: "client error message",
        name: "ClientError",
        support: expect.any(String),
        title: "custom error title",
      },
    });
  });

  test("should handle exceptions", async () => {
    const next = () =>
      Promise.reject(new RedirectError("error message", { redirect: "error" }));

    await expect(httpErrorHandlerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.status).toEqual(500);
    expect(ctx.body).toEqual({
      __meta: {
        app: "Pylon",
        environment: "test",
        name: "test_name",
        version: "0.0.0",
      },
      error: {
        id: expect.any(String),
        code: "unexpected_exception",
        data: {},
        message: "An unexpected exception occurred while handling thrown error",
        name: "UnexpectedException",
        support: expect.any(String),
        title: "Unexpected Exception",
      },
    });
  });
});
