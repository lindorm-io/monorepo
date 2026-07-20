import { JwtKit } from "@lindorm/aegis";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { httpRequestLoggerMiddleware } from "./http-request-logger-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("httpRequestLoggerMiddleware", () => {
  let ctx: any;
  let token: string;
  let signature: string;

  beforeEach(() => {
    const kryptos = KryptosKit.from.b64({
      id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
      algorithm: "ES256",
      curve: "P-256",
      privateKey:
        "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
      publicKey:
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
      purpose: "token",
      type: "EC",
      use: "sig",
    });

    token = new JwtKit({
      kryptos,
      logger: createMockLogger(),
    }).sign({ sub: "subject", exp: Math.floor(Date.now() / 1000) + 3600 }, { typ: "at" });

    [, , signature] = token.split(".");

    ctx = {
      logger: createMockLogger(),
      query: { foo: "bar" },
      request: {
        body: { username: "admin" },
        header: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          cookie: "sid=session-value; theme=dark",
        },
        method: "GET",
        url: "/test",
      },
      state: {
        metadata: "metadata",
      },
    };
  });

  test("should log request information with redacted headers", async () => {
    await expect(httpRequestLoggerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    const [, payload] = ctx.logger.verbose.mock.calls[0];

    expect(payload.request.header).toEqual({
      accept: "application/json",
      authorization: `Bearer ${token.split(".").slice(0, 2).join(".")}`,
      cookie: "sid=[Filtered]; theme=[Filtered]",
    });
  });

  test("should log neither the token signature nor any cookie value", async () => {
    await httpRequestLoggerMiddleware(ctx, vi.fn());

    const logged = JSON.stringify(ctx.logger.verbose.mock.calls);

    expect(signature).toBeTruthy();
    expect(logged).not.toContain(signature);
    expect(logged).not.toContain("session-value");
    expect(logged).not.toContain("dark");
  });

  test("should leave the request body alone", async () => {
    await httpRequestLoggerMiddleware(ctx, vi.fn());

    const [, payload] = ctx.logger.verbose.mock.calls[0];

    expect(payload.request.body).toEqual({ username: "admin" });
  });

  test("should not mutate the live request header", async () => {
    await httpRequestLoggerMiddleware(ctx, vi.fn());

    expect(ctx.request.header.authorization).toBe(`Bearer ${token}`);
    expect(ctx.request.header.cookie).toBe("sid=session-value; theme=dark");
  });
});
