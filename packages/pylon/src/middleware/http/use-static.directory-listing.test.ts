import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

describe("useStatic — directory listing", () => {
  let server: StaticTestServer;
  let port: number;

  beforeAll(async () => {
    server = await createStaticServer(
      "/assets",
      useStatic({ root, directoryListing: true, immutable: true, maxAge: "7d" }),
    );
    port = server.port;
  });

  afterAll(async () => {
    await server.close();
  });

  const listing = (path: string) =>
    rawRequest(port, path).then((res) => ({
      status: res.status,
      headers: res.headers,
      entries: res.body.length ? JSON.parse(res.body.toString()) : undefined,
    }));

  test.each([
    ["mount root, no trailing slash", "/assets"],
    ["mount root, trailing slash", "/assets/"],
  ])("%s → snake_cased sorted listing", async (_label, path) => {
    const { status, entries } = await listing(path);

    expect(status).toBe(200);
    expect(
      entries.map((e: any) => ({ name: e.name, type: e.type, size: e.size })),
    ).toEqual([
      { name: "image.jpg", type: "file", size: 22 },
      { name: "nested", type: "directory", size: 0 },
      { name: "sample.txt", type: "file", size: 100 },
      { name: "sample.txt.br", type: "file", size: 19 },
      { name: "sample.txt.gz", type: "file", size: 33 },
    ]);
    // snake_case key from the response-body middleware.
    expect(entries.every((e: any) => typeof e.last_modified === "string")).toBe(true);
    expect(entries.some((e: any) => e.name === ".hidden.txt")).toBe(false);
  });

  test.each([
    ["subdirectory, no trailing slash", "/assets/nested"],
    ["subdirectory, trailing slash", "/assets/nested/"],
  ])("%s → listing of that directory", async (_label, path) => {
    const { status, entries } = await listing(path);

    expect(status).toBe(200);
    expect(entries.map((e: any) => e.name)).toEqual(["deep.txt"]);
  });

  test("a listing is never cached and carries no validators", async () => {
    const { headers } = await listing("/assets");

    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["etag"]).toBeUndefined();
    expect(headers["last-modified"]).toBeUndefined();
    expect(headers["accept-ranges"]).toBeUndefined();
  });

  test("HEAD on a directory → headers only, no body", async () => {
    const res = await rawRequest(port, "/assets", { method: "HEAD" });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toHaveLength(0);
  });
});
