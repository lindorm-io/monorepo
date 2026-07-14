import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { RedirectError } from "../../errors/index.js";
import type { AuthorizationType } from "../../types/index.js";
import { httpErrorHandlerMiddleware } from "./http-error-handler-middleware.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("httpErrorHandlerMiddleware", () => {
  let headers: Record<string, string>;
  let logger: ReturnType<typeof createMockLogger>;
  let ctx: any;

  const unauthorized = () =>
    Promise.reject(
      new ClientError("unauthorized", { status: ClientError.Status.Unauthorized }),
    );

  const withAuthorization = (type: AuthorizationType) => {
    ctx.state.app.domain = "https://lindorm.io";
    ctx.state.authorization = { type, value: type === "none" ? null : "value" };
  };

  beforeEach(() => {
    headers = {};
    logger = createMockLogger();
    ctx = {
      body: undefined,
      logger,
      response: { get: (field: string) => headers[field.toLowerCase()] ?? "" },
      set: (field: string, value: string) => {
        headers[field.toLowerCase()] = value;
      },
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

  afterEach(vi.clearAllMocks);

  test("should do nothing when no errors are thrown", async () => {
    await expect(httpErrorHandlerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

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
        type: "urn:lindorm:error:unknown_error",
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
        type: "urn:lindorm:error:custom_error_code",
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
        type: "urn:lindorm:error:custom_error_code",
        data: { value: "data" },
        message: "client error message",
        name: "ClientError",
        support: expect.any(String),
        title: "custom error title",
      },
    });
  });

  test("should derive a WWW-Authenticate challenge on a 401", async () => {
    withAuthorization("bearer");

    await httpErrorHandlerMiddleware(ctx, unauthorized);

    expect(ctx.status).toEqual(401);
    expect(headers).toMatchSnapshot();
  });

  test("should derive a basic challenge on a 401", async () => {
    withAuthorization("basic");

    await httpErrorHandlerMiddleware(ctx, unauthorized);

    expect(headers).toMatchSnapshot();
  });

  test("should derive a dpop challenge on a 401", async () => {
    withAuthorization("dpop");

    await httpErrorHandlerMiddleware(ctx, unauthorized);

    expect(headers).toMatchSnapshot();
  });

  test("should not overwrite a challenge the handler set explicitly", async () => {
    withAuthorization("bearer");
    ctx.set("WWW-Authenticate", 'Bearer realm="lindorm.io", error="insufficient_scope"');

    await httpErrorHandlerMiddleware(ctx, unauthorized);

    expect(headers).toMatchSnapshot();
  });

  test("should not derive a challenge on a 401 without an attempted scheme", async () => {
    withAuthorization("none");

    await httpErrorHandlerMiddleware(ctx, unauthorized);

    expect(headers["www-authenticate"]).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("ctx.challenge()"));
  });

  test("should not derive a challenge on any status other than 401", async () => {
    withAuthorization("bearer");

    const next = () =>
      Promise.reject(
        new ClientError("forbidden", { status: ClientError.Status.Forbidden }),
      );

    await httpErrorHandlerMiddleware(ctx, next);

    expect(ctx.status).toEqual(403);
    expect(headers["www-authenticate"]).toBeUndefined();
  });

  test("should not derive a challenge on a redirect error", async () => {
    withAuthorization("bearer");
    ctx.redirect = vi.fn();

    const next = () =>
      Promise.reject(
        new RedirectError("redirect", {
          redirect: "https://lindorm.io/callback",
          status: ClientError.Status.Unauthorized,
        }),
      );

    await httpErrorHandlerMiddleware(ctx, next);

    expect(ctx.redirect).toHaveBeenCalledWith(
      expect.stringContaining("https://lindorm.io/callback"),
    );
    expect(headers).toEqual({});
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
        type: "urn:lindorm:error:unexpected_exception",
        data: {},
        message: "An unexpected exception occurred while handling thrown error",
        name: "UnexpectedException",
        support: expect.any(String),
        title: "Unexpected Exception",
      },
    });
  });
});
