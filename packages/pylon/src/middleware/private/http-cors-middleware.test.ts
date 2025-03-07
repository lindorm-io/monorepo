import { HttpMethod } from "@lindorm/conduit";
import { EmbedderPolicy, OpenerPolicy } from "../../enums";
import { CorsOptions } from "../../types";
import { createHttpCorsMiddleware } from "./http-cors-middleware";

describe("httpCorsMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let options: CorsOptions;

  beforeEach(() => {
    ctx = {
      method: "OPTIONS",
      get: jest.fn(),
      set: jest.fn(),
      vary: jest.fn(),
    };

    options = {
      allowCredentials: true,
      allowHeaders: ["allowed-header-1", "allowed-header-2", "allowed-header-3"],
      allowMethods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Options],
      allowOrigins: ["http://localhost:3000", "http://localhost:3001"],
      embedderPolicy: EmbedderPolicy.RequireCorp,
      exposeHeaders: ["exposed-header-1", "exposed-header-2"],
      maxAge: 600,
      openerPolicy: OpenerPolicy.SameOrigin,
      privateNetworkAccess: true,
    };

    ctx.get.mockImplementation((header: string) => {
      switch (header) {
        case "access-control-request-headers":
          return "allowed-header-1,allowed-header-2";

        case "access-control-request-method":
          return "post";

        case "access-control-request-private-network":
          return "true";

        case "origin":
          return "http://localhost:3000";

        case "x-origin":
          return "http://localhost:3001";

        default:
          return null;
      }
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve next on a normal request", async () => {
    ctx.method = "POST";

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should resolve options with arrays", async () => {
    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-headers",
      "allowed-header-1,allowed-header-2",
    );
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-methods", "POST");
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-origin",
      "http://localhost:3000",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-expose-headers",
      "exposed-header-1,exposed-header-2",
    );
    expect(ctx.set).toHaveBeenCalledWith("cross-origin-embedder-policy", "require-corp");
    expect(ctx.set).toHaveBeenCalledWith("cross-origin-opener-policy", "same-origin");
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-private-network", "true");
  });

  test("should resolve options with wildcards", async () => {
    await expect(
      createHttpCorsMiddleware({
        allowHeaders: "*",
        allowMethods: "*",
        allowOrigins: "*",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-headers", "*");
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-methods", "*");
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-origin", "*");
  });

  test("should immediately respond with CORS on preflight requests", async () => {
    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("should throw on invalid options", async () => {
    expect(() =>
      createHttpCorsMiddleware({
        allowCredentials: true,
        allowOrigins: "*",
      }),
    ).toThrow();
  });

  test("should throw on invalid request origin during preflight", async () => {
    options.allowOrigins = ["http://localhost:4000"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Invalid origin");

    expect(next).not.toHaveBeenCalled();
  });

  test("should not set allow-origin if no origin is present and not wildcard", async () => {
    ctx.get.mockImplementation((header: string) => {
      if (header === "Origin") return null;
      return null;
    });

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalledWith(
      "access-control-allow-origin",
      expect.anything(),
    );
  });

  test("should throw on invalid method in preflight", async () => {
    options.allowMethods = [HttpMethod.Get];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Invalid method");

    expect(next).not.toHaveBeenCalled();
  });

  test("should throw on invalid headers in preflight", async () => {
    options.allowHeaders = ["allowed-header-1"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Invalid headers");

    expect(next).not.toHaveBeenCalled();
  });

  test("should not set Access-Control-Allow-Private-Network if not requested", async () => {
    ctx.get.mockImplementation((header: string) => {
      switch (header) {
        case "access-control-request-headers":
          return "allowed-header-1,allowed-header-2";

        case "access-control-request-method":
          return "post";

        case "origin":
          return "http://localhost:3000";

        default:
          return null;
      }
    });

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalledWith(
      "access-control-allow-private-network",
      "true",
    );
  });

  test("should allow credentials with explicit origins", async () => {
    options.allowCredentials = true;
    options.allowOrigins = ["http://localhost:3000"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-origin",
      "http://localhost:3000",
    );
  });

  test("should handle no allowOrigins configured (no CORS)", async () => {
    delete options.allowOrigins;

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalledWith(
      "access-control-allow-origin",
      expect.anything(),
    );
  });
});
