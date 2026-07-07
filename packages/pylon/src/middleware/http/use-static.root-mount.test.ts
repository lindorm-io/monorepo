import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

describe('useStatic — root mount ("/")', () => {
  let server: StaticTestServer;
  let port: number;

  beforeAll(async () => {
    server = await createStaticServer("/", useStatic({ root }));
    port = server.port;
  });

  afterAll(async () => {
    await server.close();
  });

  test("serves a top-level file", async () => {
    const res = await rawRequest(port, "/sample.txt");

    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe("0123456789".repeat(10));
  });

  test("serves a nested file", async () => {
    const res = await rawRequest(port, "/nested/deep.txt");

    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe("deep nested content\n");
  });

  test("404s a missing file", async () => {
    const res = await rawRequest(port, "/nope.txt");
    const parsed = JSON.parse(res.body.toString());

    expect(res.status).toBe(404);
    expect(parsed.error.code).toBe("static_file_not_found");
  });

  test("404s a dotfile at the root", async () => {
    const res = await rawRequest(port, "/.hidden.txt");

    expect(res.status).toBe(404);
  });
});
