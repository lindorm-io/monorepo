import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
  stableHeaders,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

describe("useStatic — content-type and cache headers", () => {
  const servers: Array<StaticTestServer> = [];
  const spawn = async (mount: string, mw: ReturnType<typeof useStatic>) => {
    const server = await createStaticServer(mount, mw);
    servers.push(server);
    return server.port;
  };

  let defaultPort: number;
  let sevenDayPort: number;
  let msPort: number;
  let immutablePort: number;
  let privatePort: number;
  let precompressedPort: number;

  beforeAll(async () => {
    defaultPort = await spawn("/assets", useStatic({ root }));
    sevenDayPort = await spawn("/assets", useStatic({ root, maxAge: "7d" }));
    msPort = await spawn("/assets", useStatic({ root, maxAge: 1500 }));
    immutablePort = await spawn(
      "/assets",
      useStatic({ root, maxAge: "1h", immutable: true }),
    );
    privatePort = await spawn("/assets", useStatic({ root, visibility: "private" }));
    precompressedPort = await spawn("/assets", useStatic({ root, precompressed: true }));
  });

  afterAll(async () => {
    await Promise.all(servers.map((s) => s.close()));
  });

  describe("content-type from the original extension", () => {
    test("txt → text/plain", async () => {
      const res = await rawRequest(defaultPort, "/assets/sample.txt");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
    });

    test("jpg → image/jpeg", async () => {
      const res = await rawRequest(defaultPort, "/assets/image.jpg");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/jpeg");
    });

    test("stays text/plain when a .br sibling is served", async () => {
      const res = await rawRequest(precompressedPort, "/assets/sample.txt", {
        headers: { "accept-encoding": "br" },
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-encoding"]).toBe("br");
      expect(res.headers["content-type"]).toContain("text/plain");
    });
  });

  describe("cache-control matrix", () => {
    test("default → public, max-age=0", async () => {
      const res = await rawRequest(defaultPort, "/assets/sample.txt");
      expect(res.headers["cache-control"]).toBe("public, max-age=0");
    });

    test("ReadableTime maxAge → seconds", async () => {
      const res = await rawRequest(sevenDayPort, "/assets/sample.txt");
      expect(res.headers["cache-control"]).toBe("public, max-age=604800");
    });

    test("numeric millisecond maxAge → floored to seconds", async () => {
      const res = await rawRequest(msPort, "/assets/sample.txt");
      expect(res.headers["cache-control"]).toBe("public, max-age=1");
    });

    test("immutable is appended", async () => {
      const res = await rawRequest(immutablePort, "/assets/sample.txt");
      expect(res.headers["cache-control"]).toBe("public, max-age=3600, immutable");
    });

    test("private visibility", async () => {
      const res = await rawRequest(privatePort, "/assets/sample.txt");
      expect(res.headers["cache-control"]).toBe("private, max-age=0");
    });
  });

  describe("validators and range advertisement", () => {
    test("emits a weak ETag, Last-Modified and Accept-Ranges", async () => {
      const res = await rawRequest(defaultPort, "/assets/sample.txt");

      expect(res.headers["etag"]).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
      expect(res.headers["last-modified"]).toBeTruthy();
      expect(res.headers["accept-ranges"]).toBe("bytes");
    });

    test("stable header subset for a plain 200", async () => {
      const res = await rawRequest(defaultPort, "/assets/sample.txt");

      expect(res.status).toBe(200);
      expect(stableHeaders(res.headers)).toMatchSnapshot();
    });

    test("serves the exact 100-byte body", async () => {
      const res = await rawRequest(defaultPort, "/assets/sample.txt");

      expect(res.body.toString()).toBe("0123456789".repeat(10));
    });
  });
});
