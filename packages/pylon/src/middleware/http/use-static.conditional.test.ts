import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

describe("useStatic — conditional requests", () => {
  let server: StaticTestServer;
  let port: number;
  let etag: string;
  let lastModified: string;

  beforeAll(async () => {
    server = await createStaticServer("/assets", useStatic({ root, maxAge: "1h" }));
    port = server.port;

    const seed = await rawRequest(port, "/assets/sample.txt");
    etag = seed.headers["etag"] as string;
    lastModified = seed.headers["last-modified"] as string;
  });

  afterAll(async () => {
    await server.close();
  });

  test("If-None-Match matching the ETag → 304", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { "if-none-match": etag },
    });

    expect(res.status).toBe(304);
  });

  test("If-None-Match with a different ETag → 200", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { "if-none-match": 'W/"deadbeef-1"' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(100);
  });

  test("If-Modified-Since at Last-Modified → 304", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { "if-modified-since": lastModified },
    });

    expect(res.status).toBe(304);
  });

  test("If-Modified-Since in the past → 200", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { "if-modified-since": new Date(0).toUTCString() },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(100);
  });

  test("304 carries no body and keeps the validators, drops Content-Length", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { "if-none-match": etag },
    });

    expect(res.status).toBe(304);
    expect(res.body).toHaveLength(0);
    expect(res.headers["etag"]).toBe(etag);
    expect(res.headers["last-modified"]).toBe(lastModified);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    expect(res.headers["content-length"]).toBeUndefined();
  });
});
