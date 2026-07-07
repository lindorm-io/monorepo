import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");
const FULL = "0123456789".repeat(10);

describe("useStatic — range requests", () => {
  let server: StaticTestServer;
  let port: number;

  beforeAll(async () => {
    server = await createStaticServer("/assets", useStatic({ root }));
    port = server.port;
  });

  afterAll(async () => {
    await server.close();
  });

  const range = (value: string) =>
    rawRequest(port, "/assets/sample.txt", { headers: { range: value } });

  describe("206 Partial Content", () => {
    test("bytes=0-9 → first ten bytes", async () => {
      const res = await range("bytes=0-9");

      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toBe("bytes 0-9/100");
      expect(res.headers["content-length"]).toBe("10");
      expect(res.body.toString()).toBe(FULL.slice(0, 10));
    });

    test("bytes=90- → open-ended tail", async () => {
      const res = await range("bytes=90-");

      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toBe("bytes 90-99/100");
      expect(res.headers["content-length"]).toBe("10");
      expect(res.body.toString()).toBe(FULL.slice(90, 100));
    });

    test("bytes=-10 → final ten bytes", async () => {
      const res = await range("bytes=-10");

      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toBe("bytes 90-99/100");
      expect(res.body.toString()).toBe(FULL.slice(90, 100));
    });

    test("bytes=0-999 → end clamped to the last byte", async () => {
      const res = await range("bytes=0-999");

      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toBe("bytes 0-99/100");
      expect(res.headers["content-length"]).toBe("100");
      expect(res.body.toString()).toBe(FULL);
    });
  });

  describe("ignored → full 200", () => {
    test.each([
      ["multiple ranges", "bytes=0-9,20-29"],
      ["invalid syntax", "bytes=abc"],
      ["non-bytes unit", "items=0-9"],
    ])("%s", async (_label, value) => {
      const res = await range(value);

      expect(res.status).toBe(200);
      expect(res.headers["content-range"]).toBeUndefined();
      expect(res.body.toString()).toBe(FULL);
    });
  });

  describe("416 Range Not Satisfiable", () => {
    test.each([
      ["bytes=100- (first-byte-pos at size)", "bytes=100-"],
      ["bytes=-0 (zero-length suffix)", "bytes=-0"],
    ])("%s → 416 with Content-Range and no body", async (_label, value) => {
      const res = await range(value);

      expect(res.status).toBe(416);
      expect(res.headers["content-range"]).toBe("bytes */100");
      // Intended behaviour: no status-message body appended by koa.
      expect(res.body).toHaveLength(0);
    });
  });
});
