import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { PylonCorsSettings } from "../../types/index.js";
import { createHttpCorsMiddleware } from "./http-cors-middleware.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("httpCorsMiddleware", () => {
  const next = vi.fn();

  let ctx: any;
  let options: PylonCorsSettings;

  beforeEach(() => {
    ctx = {
      method: "OPTIONS",
      get: vi.fn(),
      set: vi.fn(),
      vary: vi.fn(),
    };

    options = {
      allowCredentials: true,
      allowHeaders: ["allowed-header-1", "allowed-header-2", "allowed-header-3"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowOrigins: ["http://localhost:3000", "http://localhost:3001"],
      embedderPolicy: "require-corp",
      exposeHeaders: ["exposed-header-1", "exposed-header-2"],
      maxAge: 600,
      openerPolicy: "same-origin",
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

  afterEach(vi.clearAllMocks);

  test("should set origin headers and call next on a normal request", async () => {
    ctx.method = "POST";

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    // The actual response must carry the origin + credentials + exposed headers
    // (F17 symptom 1) — but NOT the preflight-only allow-methods/-headers/max-age.
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-origin",
      "http://localhost:3000",
    );
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-expose-headers",
      "exposed-header-1,exposed-header-2",
    );
    expect(ctx.set).not.toHaveBeenCalledWith(
      "access-control-allow-methods",
      expect.anything(),
    );
    expect(ctx.set).not.toHaveBeenCalledWith(
      "access-control-allow-headers",
      expect.anything(),
    );
    expect(ctx.set).not.toHaveBeenCalledWith("access-control-max-age", expect.anything());
    expect(next).toHaveBeenCalled();
  });

  test("should call next without origin headers when origin is not allowed on a normal request", async () => {
    ctx.method = "GET";
    options.allowOrigins = ["http://localhost:9999"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    // A disallowed origin on an actual request is rejected (403), consistent
    // with the preflight — the response never carries an allow-origin header.
    expect(ctx.status).toEqual(403);
    expect(next).not.toHaveBeenCalled();
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

  test("should canonicalise an array allowHeaders and warn via the logger (E9)", () => {
    const logger = createMockLogger();
    const opts: PylonCorsSettings = {
      allowOrigins: "*",
      allowHeaders: ["accept", "content-type", "x-foo"],
    };

    // Normalisation runs at construction: strip safelisted `accept`, strip the
    // listed `content-type`, then auto-inject it once — leaving `x-foo` + a
    // single `content-type`.
    createHttpCorsMiddleware(opts, logger);

    expect(opts.allowHeaders).toEqual(["x-foo", "content-type"]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"accept" is already CORS-safelisted'),
    );
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
    expect(ctx.body).toEqual("Request origin is not allowed");

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
    options.allowMethods = ["GET"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Requested method is not allowed");

    expect(next).not.toHaveBeenCalled();
  });

  test("should throw on invalid headers in preflight", async () => {
    options.allowHeaders = ["allowed-header-1"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("One or more requested headers are not allowed");

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
