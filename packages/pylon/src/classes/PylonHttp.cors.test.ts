import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import http from "http";
import type { AddressInfo } from "net";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("PylonHttp CORS integration (F17)", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const router = new PylonRouter();

    router.get("/genres", async (ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });
    router.post("/genres", async (ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    const pylonHttp = new PylonHttp({
      amphora: createMockAmphora() as any,
      logger: createMockLogger(),
      cors: {
        allowOrigins: "*",
        allowMethods: ["GET", "POST"],
        allowHeaders: ["content-type"],
        maxAge: "1h",
      },
      routes: { path: "/v1", router },
    });

    pylonHttp.loadMiddleware();
    await pylonHttp.loadRouters();

    server = http.createServer(pylonHttp.callback);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  // F17 symptom 1: the ACTUAL cross-origin response must carry ACAO, not just
  // the preflight — otherwise the browser discards every real response.
  test("an actual cross-origin GET carries Access-Control-Allow-Origin", async () => {
    const res = await fetch(`${baseUrl}/v1/genres?page_size=1`, {
      headers: { origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  // F17 symptom 2: a valid preflight (allowed origin + allowed method, no
  // Access-Control-Request-Headers) must return 204, not 403. Real Koa returns
  // "" for the missing request-headers header, which previously became [""] and
  // failed the allowlist.
  test("a valid preflight returns 204 with the negotiated CORS headers", async () => {
    const res = await fetch(`${baseUrl}/v1/genres`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET");
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type");
  });

  // A same-origin / non-browser request (no Origin header) must not be rejected
  // now that origin handling runs on every request.
  test("a request without an Origin header is not rejected", async () => {
    const res = await fetch(`${baseUrl}/v1/genres`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
