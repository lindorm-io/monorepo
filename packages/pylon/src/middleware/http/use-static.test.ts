import Koa from "koa";
import http from "http";
import type { AddressInfo } from "net";
import { join } from "path";
import { PylonRouter } from "../../classes/PylonRouter.js";
import { httpResponseBodyMiddleware } from "../../internal/middleware/http-response-body-middleware.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const fixtures = join(__dirname, "..", "..", "__fixtures__", "static-assets");

// Raw request-target so Node does not normalise `%2e%2e` away before it reaches
// koa-router (which decodes it to `..` in params.path — the case our guard must
// catch). `fetch` would collapse it client-side.
const rawGet = (port: number, path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });

describe("useStatic", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const router = new PylonRouter();
    router.static("/assets", useStatic({ root: fixtures, maxAge: "7d" }));

    const app = new Koa();
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

  test("serves a file with content-type and cache headers", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/assets/sample.txt`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("etag")).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(res.headers.get("last-modified")).toBeTruthy();

    const body = await res.text();
    expect(body).toHaveLength(100);
    expect(body).toBe("0123456789".repeat(10));
  });

  test("rejects a decoded path-traversal attempt with 404", async () => {
    const res = await rawGet(port, "/assets/%2e%2e/%2e%2e/etc/passwd");

    expect(res.status).toBe(404);
    expect(res.body).not.toContain("passwd");
    expect(res.body).not.toContain("etc");
  });
});
