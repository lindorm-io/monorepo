import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

describe("useStatic — If-Range", () => {
  let server: StaticTestServer;
  let port: number;
  let etag: string;
  let lastModified: string;

  beforeAll(async () => {
    server = await createStaticServer("/assets", useStatic({ root }));
    port = server.port;

    const seed = await rawRequest(port, "/assets/sample.txt");
    etag = seed.headers["etag"] as string;
    lastModified = seed.headers["last-modified"] as string;
  });

  afterAll(async () => {
    await server.close();
  });

  test("entity-tag If-Range never matches a weak ETag → full 200", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { range: "bytes=0-9", "if-range": etag },
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-range"]).toBeUndefined();
    expect(res.body).toHaveLength(100);
  });

  test("date If-Range equal to Last-Modified → honours the range (206)", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { range: "bytes=0-9", "if-range": lastModified },
    });

    expect(res.status).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 0-9/100");
    expect(res.body.toString()).toBe("0123456789");
  });

  test("stale date If-Range → ignores the range, full 200", async () => {
    const res = await rawRequest(port, "/assets/sample.txt", {
      headers: { range: "bytes=0-9", "if-range": new Date(0).toUTCString() },
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-range"]).toBeUndefined();
    expect(res.body).toHaveLength(100);
  });
});
