import { CorsError } from "../../errors";
import {
  handleAccessControlCredentials,
  handleAccessControlExposeHeaders,
  handleAccessControlHeaders,
  handleAccessControlMaxAge,
  handleAccessControlMethods,
  handleAccessControlOrigin,
  handleAccessControlPrivateNetwork,
  handleCrossOriginEmbedderPolicy,
  handleCrossOriginOpenerPolicy,
} from "./cors-handlers";
import { describe, expect, test, vi } from "vitest";

const createCtx = (headers: Record<string, string> = {}): any => {
  const responseHeaders: Record<string, string> = {};
  return {
    get: vi.fn((key: string) => headers[key.toLowerCase()]),
    set: vi.fn((key: string, value: string) => {
      responseHeaders[key] = value;
    }),
    _responseHeaders: responseHeaders,
  };
};

describe("handleAccessControlOrigin", () => {
  test("should return false when allowOrigins is not set", () => {
    const ctx = createCtx();
    expect(handleAccessControlOrigin(ctx, {})).toBe(false);
  });

  test("should set wildcard origin", () => {
    const ctx = createCtx();
    expect(handleAccessControlOrigin(ctx, { allowOrigins: "*" })).toBe(true);
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-origin", "*");
  });

  test("should set matching origin from list", () => {
    const ctx = createCtx({ origin: "https://test.lindorm.io" });
    const result = handleAccessControlOrigin(ctx, {
      allowOrigins: ["https://test.lindorm.io", "https://other.lindorm.io"],
    });
    expect(result).toBe(true);
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-origin",
      "https://test.lindorm.io",
    );
  });

  test("should strip trailing slash from origin", () => {
    const ctx = createCtx({ origin: "https://test.lindorm.io/" });
    const result = handleAccessControlOrigin(ctx, {
      allowOrigins: ["https://test.lindorm.io"],
    });
    expect(result).toBe(true);
  });

  test("should fall back to x-origin header", () => {
    const ctx = createCtx({ "x-origin": "https://test.lindorm.io" });
    const result = handleAccessControlOrigin(ctx, {
      allowOrigins: ["https://test.lindorm.io"],
    });
    expect(result).toBe(true);
  });

  test("should throw CorsError for non-matching origin", () => {
    const ctx = createCtx({ origin: "https://evil.example.com" });
    expect(() =>
      handleAccessControlOrigin(ctx, { allowOrigins: ["https://test.lindorm.io"] }),
    ).toThrow(CorsError);
  });

  test("should throw CorsError when no origin header and list is configured", () => {
    const ctx = createCtx();
    expect(() =>
      handleAccessControlOrigin(ctx, { allowOrigins: ["https://test.lindorm.io"] }),
    ).toThrow(CorsError);
  });
});

describe("handleAccessControlCredentials", () => {
  test("should set credentials to true", () => {
    const ctx = createCtx();
    handleAccessControlCredentials(ctx, { allowCredentials: true });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-credentials", "true");
  });

  test("should set credentials to false", () => {
    const ctx = createCtx();
    handleAccessControlCredentials(ctx, { allowCredentials: false });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-credentials", "false");
  });

  test("should not set header when allowCredentials is undefined", () => {
    const ctx = createCtx();
    handleAccessControlCredentials(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });
});

describe("handleAccessControlHeaders", () => {
  test("should not set header when allowHeaders is not set", () => {
    const ctx = createCtx();
    handleAccessControlHeaders(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set wildcard headers", () => {
    const ctx = createCtx();
    handleAccessControlHeaders(ctx, { allowHeaders: "*" });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-headers", "*");
  });

  test("should set matching request headers", () => {
    const ctx = createCtx({
      "access-control-request-headers": "content-type,authorization",
    });
    handleAccessControlHeaders(ctx, {
      allowHeaders: ["content-type", "authorization"],
    });
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-headers",
      "content-type,authorization",
    );
  });

  test("should set all config headers when no request headers", () => {
    const ctx = createCtx();
    handleAccessControlHeaders(ctx, {
      allowHeaders: ["content-type", "authorization"],
    });
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-allow-headers",
      "content-type,authorization",
    );
  });

  test("should throw CorsError when request headers are not in config", () => {
    const ctx = createCtx({
      "access-control-request-headers": "x-custom-header",
    });
    expect(() =>
      handleAccessControlHeaders(ctx, { allowHeaders: ["content-type"] }),
    ).toThrow(CorsError);
  });
});

describe("handleAccessControlMethods", () => {
  test("should not set header when allowMethods is not set", () => {
    const ctx = createCtx();
    handleAccessControlMethods(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set wildcard methods", () => {
    const ctx = createCtx();
    handleAccessControlMethods(ctx, { allowMethods: "*" });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-methods", "*");
  });

  test("should set matching request method", () => {
    const ctx = createCtx({ "access-control-request-method": "POST" });
    handleAccessControlMethods(ctx, { allowMethods: ["GET", "POST"] });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-methods", "POST");
  });

  test("should set all config methods when no request method", () => {
    const ctx = createCtx();
    handleAccessControlMethods(ctx, { allowMethods: ["GET", "POST"] });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-methods", "GET,POST");
  });

  test("should throw CorsError when request method is not in config", () => {
    const ctx = createCtx({ "access-control-request-method": "DELETE" });
    expect(() =>
      handleAccessControlMethods(ctx, { allowMethods: ["GET", "POST"] }),
    ).toThrow(CorsError);
  });
});

describe("handleAccessControlExposeHeaders", () => {
  test("should not set header when exposeHeaders is not set", () => {
    const ctx = createCtx();
    handleAccessControlExposeHeaders(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set expose headers", () => {
    const ctx = createCtx();
    handleAccessControlExposeHeaders(ctx, {
      exposeHeaders: ["x-request-id", "x-correlation-id"],
    });
    expect(ctx.set).toHaveBeenCalledWith(
      "access-control-expose-headers",
      "x-request-id,x-correlation-id",
    );
  });

  test("should not set header when exposeHeaders is empty array", () => {
    const ctx = createCtx();
    handleAccessControlExposeHeaders(ctx, { exposeHeaders: [] });
    expect(ctx.set).not.toHaveBeenCalled();
  });
});

describe("handleAccessControlMaxAge", () => {
  test("should not set header when maxAge is not set", () => {
    const ctx = createCtx();
    handleAccessControlMaxAge(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set max age from number", () => {
    const ctx = createCtx();
    handleAccessControlMaxAge(ctx, { maxAge: 3600 });
    expect(ctx.set).toHaveBeenCalledWith("access-control-max-age", "3600");
  });

  test("should set max age from readable time string", () => {
    const ctx = createCtx();
    handleAccessControlMaxAge(ctx, { maxAge: "1 hour" });
    expect(ctx.set).toHaveBeenCalledWith("access-control-max-age", "3600");
  });
});

describe("handleAccessControlPrivateNetwork", () => {
  test("should not set header when privateNetworkAccess is not set", () => {
    const ctx = createCtx();
    handleAccessControlPrivateNetwork(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set private network when request header is present", () => {
    const ctx = createCtx({
      "access-control-request-private-network": "true",
    });
    handleAccessControlPrivateNetwork(ctx, { privateNetworkAccess: true });
    expect(ctx.set).toHaveBeenCalledWith("access-control-allow-private-network", "true");
  });

  test("should not set header when request header is not present", () => {
    const ctx = createCtx();
    handleAccessControlPrivateNetwork(ctx, { privateNetworkAccess: true });
    expect(ctx.set).not.toHaveBeenCalled();
  });
});

describe("handleCrossOriginEmbedderPolicy", () => {
  test("should not set header when embedderPolicy is not set", () => {
    const ctx = createCtx();
    handleCrossOriginEmbedderPolicy(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set embedder policy", () => {
    const ctx = createCtx();
    handleCrossOriginEmbedderPolicy(ctx, { embedderPolicy: "require-corp" });
    expect(ctx.set).toHaveBeenCalledWith("cross-origin-embedder-policy", "require-corp");
  });
});

describe("handleCrossOriginOpenerPolicy", () => {
  test("should not set header when openerPolicy is not set", () => {
    const ctx = createCtx();
    handleCrossOriginOpenerPolicy(ctx, {});
    expect(ctx.set).not.toHaveBeenCalled();
  });

  test("should set opener policy", () => {
    const ctx = createCtx();
    handleCrossOriginOpenerPolicy(ctx, { openerPolicy: "same-origin" });
    expect(ctx.set).toHaveBeenCalledWith("cross-origin-opener-policy", "same-origin");
  });
});
