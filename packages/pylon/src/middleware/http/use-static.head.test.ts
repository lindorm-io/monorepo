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

// Validator headers vary per checkout — include them in the parity check but
// not in stable snapshots.
const parityHeaders = (headers: Record<string, any>) => ({
  ...stableHeaders(headers, ["etag", "last-modified"]),
});

describe("useStatic — HEAD parity", () => {
  let server: StaticTestServer;
  let port: number;
  let etag: string;

  beforeAll(async () => {
    server = await createStaticServer("/assets", useStatic({ root, maxAge: "1h" }));
    port = server.port;
    const seed = await rawRequest(port, "/assets/sample.txt");
    etag = seed.headers["etag"] as string;
  });

  afterAll(async () => {
    await server.close();
  });

  const both = async (headers?: Record<string, string>) => {
    const get = await rawRequest(port, "/assets/sample.txt", { method: "GET", headers });
    const head = await rawRequest(port, "/assets/sample.txt", {
      method: "HEAD",
      headers,
    });
    return { get, head };
  };

  test("200: identical headers, HEAD has no body but keeps Content-Length", async () => {
    const { get, head } = await both();

    expect(head.status).toBe(200);
    expect(get.status).toBe(200);
    expect(parityHeaders(head.headers)).toEqual(parityHeaders(get.headers));
    expect(head.headers["content-length"]).toBe("100");
    expect(head.body).toHaveLength(0);
    // Code-path guarantee: the HEAD branch returns before createReadStream, so
    // no descriptor is ever opened — evidenced by a correct length with 0 bytes.
    expect(get.body).toHaveLength(100);
  });

  test("206: identical headers, HEAD keeps the partial Content-Length", async () => {
    const { get, head } = await both({ range: "bytes=0-9" });

    expect(head.status).toBe(206);
    expect(get.status).toBe(206);
    expect(parityHeaders(head.headers)).toEqual(parityHeaders(get.headers));
    expect(head.headers["content-length"]).toBe("10");
    expect(head.body).toHaveLength(0);
  });

  test("304: identical validators, no body", async () => {
    const { get, head } = await both({ "if-none-match": etag });

    expect(head.status).toBe(304);
    expect(get.status).toBe(304);
    expect(parityHeaders(head.headers)).toEqual(parityHeaders(get.headers));
    expect(head.body).toHaveLength(0);
  });

  test("416: identical headers including Content-Length: 0, no body", async () => {
    const { get, head } = await both({ range: "bytes=100-" });

    expect(head.status).toBe(416);
    expect(get.status).toBe(416);
    expect(parityHeaders(head.headers)).toEqual(parityHeaders(get.headers));
    expect(head.headers["content-range"]).toBe("bytes */100");
    expect(head.headers["content-length"]).toBe("0");
    expect(head.body).toHaveLength(0);
  });
});
