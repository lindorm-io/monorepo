import { readFileSync } from "fs";
import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");
const brBytes = readFileSync(join(root, "sample.txt.br"));
const gzBytes = readFileSync(join(root, "sample.txt.gz"));

describe("useStatic — precompressed variants", () => {
  let precompressed: StaticTestServer;
  let plain: StaticTestServer;

  beforeAll(async () => {
    precompressed = await createStaticServer(
      "/assets",
      useStatic({ root, precompressed: true }),
    );
    plain = await createStaticServer("/assets", useStatic({ root }));
  });

  afterAll(async () => {
    await Promise.all([precompressed.close(), plain.close()]);
  });

  const get = (headers?: Record<string, string>) =>
    rawRequest(precompressed.port, "/assets/sample.txt", { headers });

  test("Accept-Encoding br → .br sibling, -br etag, sibling Content-Length", async () => {
    const res = await get({ "accept-encoding": "br" });

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.headers["etag"]).toMatch(/-br"$/);
    expect(res.headers["content-length"]).toBe(String(brBytes.length));
    expect(res.headers["vary"]).toBe("Accept-Encoding");
    // Raw bytes of the sibling (no auto-decompression through http.request).
    expect(res.body.equals(brBytes)).toBe(true);
  });

  test("Accept-Encoding gzip (no br) → .gz sibling, -gz etag", async () => {
    const res = await get({ "accept-encoding": "gzip" });

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.headers["etag"]).toMatch(/-gz"$/);
    expect(res.headers["content-length"]).toBe(String(gzBytes.length));
    expect(res.body.equals(gzBytes)).toBe(true);
  });

  test("br preferred over gzip when both are accepted", async () => {
    const res = await get({ "accept-encoding": "gzip, br" });

    expect(res.headers["content-encoding"]).toBe("br");
  });

  test("identity when no compressed encoding is accepted, but Vary still set", async () => {
    const res = await get({ "accept-encoding": "identity" });

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.headers["content-length"]).toBe("100");
    expect(res.headers["etag"]).toMatch(/[0-9a-f]"$/);
    expect(res.headers["vary"]).toBe("Accept-Encoding");
    expect(res.body.toString()).toBe("0123456789".repeat(10));
  });

  test("Vary is present on a 304 from a precompressed mount", async () => {
    const seed = await get({ "accept-encoding": "identity" });
    const etag = seed.headers["etag"] as string;

    const res = await get({ "accept-encoding": "identity", "if-none-match": etag });

    expect(res.status).toBe(304);
    expect(res.headers["vary"]).toBe("Accept-Encoding");
  });

  test("non-precompressed mount never sets Vary, even with Accept-Encoding: br", async () => {
    const res = await rawRequest(plain.port, "/assets/sample.txt", {
      headers: { "accept-encoding": "br" },
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.headers["vary"]).toBeUndefined();
  });
});
