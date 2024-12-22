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
      method: "post",
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
        case "Access-Control-Request-Headers":
          return "allowed-header-1,allowed-header-2";

        case "Access-Control-Request-Method":
          return "post";

        case "Access-Control-Request-Private-Network":
          return "true";

        case "Origin":
          return "http://localhost:3000";

        case "X-Origin":
          return "http://localhost:3001";

        default:
          return null;
      }
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve options with arrays on a normal request", async () => {
    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      "allowed-header-1,allowed-header-2,allowed-header-3",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "http://localhost:3000",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Expose-Headers",
      "exposed-header-1,exposed-header-2",
    );
    expect(ctx.set).toHaveBeenCalledWith("Cross-Origin-Opener-Policy", "same-origin");
  });

  test("should resolve options with arrays on a preflight request", async () => {
    ctx.method = "OPTIONS";

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      "allowed-header-1,allowed-header-2",
    );
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Methods", "POST");
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "http://localhost:3000",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Expose-Headers",
      "exposed-header-1,exposed-header-2",
    );
    expect(ctx.set).toHaveBeenCalledWith("Cross-Origin-Embedder-Policy", "require-corp");
    expect(ctx.set).toHaveBeenCalledWith("Cross-Origin-Opener-Policy", "same-origin");
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Private-Network", "true");
  });

  test("should resolve options with wildcards on a normal request", async () => {
    await expect(
      createHttpCorsMiddleware({
        allowHeaders: "*",
        allowMethods: "*",
        allowOrigins: "*",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Headers", "*");
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Methods", "*");
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
  });

  test("should resolve options with wildcards on a preflight request", async () => {
    ctx.method = "OPTIONS";

    await expect(
      createHttpCorsMiddleware({
        allowHeaders: "*",
        allowMethods: "*",
        allowOrigins: "*",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Headers", "*");
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Methods", "*");
    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
  });

  test("should immediately respond with CORS on preflight requests", async () => {
    ctx.method = "OPTIONS";

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
    ctx.method = "OPTIONS";
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
      "Access-Control-Allow-Origin",
      expect.anything(),
    );
  });

  test("should throw on invalid method in preflight", async () => {
    ctx.method = "OPTIONS";
    options.allowMethods = [HttpMethod.Get];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Invalid method");

    expect(next).not.toHaveBeenCalled();
  });

  test("should throw on invalid headers in preflight", async () => {
    ctx.method = "OPTIONS";
    options.allowHeaders = ["allowed-header-1"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.status).toEqual(403);
    expect(ctx.body).toEqual("Invalid headers");

    expect(next).not.toHaveBeenCalled();
  });

  test("should not set Access-Control-Allow-Private-Network if not requested", async () => {
    ctx.method = "OPTIONS";
    ctx.get.mockImplementation((header: string) => {
      switch (header) {
        case "Access-Control-Request-Headers":
          return "allowed-header-1,allowed-header-2";
        case "Access-Control-Request-Method":
          return "post";
        case "Origin":
          return "http://localhost:3000";
        default:
          return null;
      }
    });

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalledWith(
      "Access-Control-Allow-Private-Network",
      "true",
    );
  });

  test("should allow credentials with explicit origins", async () => {
    options.allowCredentials = true;
    options.allowOrigins = ["http://localhost:3000"];

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
    expect(ctx.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "http://localhost:3000",
    );
  });

  test("should handle no allowOrigins configured (no CORS)", async () => {
    delete options.allowOrigins;

    await expect(createHttpCorsMiddleware(options)(ctx, next)).resolves.not.toThrow();

    expect(ctx.set).not.toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      expect.anything(),
    );
  });
});
