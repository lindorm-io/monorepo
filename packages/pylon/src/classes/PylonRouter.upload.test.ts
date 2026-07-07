import http from "http";
import Koa from "koa";
import type { AddressInfo } from "net";
import request from "supertest";
import { httpErrorHandlerMiddleware } from "../internal/middleware/http-error-handler-middleware.js";
import { httpResponseBodyMiddleware } from "../internal/middleware/http-response-body-middleware.js";
import type { PylonHttpMiddleware } from "../types/index.js";
import { PylonRouter } from "./PylonRouter.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const terminal: PylonHttpMiddleware = async (ctx) => {
  ctx.status = 200;
  ctx.body = { ok: true };
};

describe("PylonRouter.upload", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const router = new PylonRouter();
    router.upload("/upload", terminal);

    const app = new Koa();
    app.use(httpErrorHandlerMiddleware as any);
    app.use(httpResponseBodyMiddleware as any);
    app.use(router.routes() as any).use(router.allowedMethods() as any);

    server = http.createServer(app.callback());
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  test("registers one POST layer and one PUT layer for the wildcard subtree", () => {
    const router = new PylonRouter();
    router.upload("/upload", terminal);

    const layers = router.stack.map((l) => ({ path: l.path, methods: l.methods }));

    // `.post()`/`.put()` are separate layers (unlike `.get()` bundling HEAD).
    expect(layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/upload{/*path}",
          methods: expect.arrayContaining(["POST"]),
        }),
        expect.objectContaining({
          path: "/upload{/*path}",
          methods: expect.arrayContaining(["PUT"]),
        }),
      ]),
    );
  });

  test("POST reaches the mount", async () => {
    const res = await request(`http://127.0.0.1:${port}`).post("/upload/a/b");
    expect(res.status).toBe(200);
  });

  test("PUT reaches the mount", async () => {
    const res = await request(`http://127.0.0.1:${port}`).put("/upload/a/b.txt");
    expect(res.status).toBe(200);
  });

  test.each(["get", "delete"] as const)(
    "%s → 405 with an Allow header listing POST and PUT",
    async (method) => {
      const res = await request(`http://127.0.0.1:${port}`)[method]("/upload/a/b");

      expect(res.status).toBe(405);

      const allow = (res.headers["allow"] ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .sort();
      expect(allow).toEqual(expect.arrayContaining(["POST", "PUT"]));
    },
  );
});
