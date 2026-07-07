import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

const sortAllow = (allow: string | undefined) =>
  (allow ?? "")
    .split(",")
    .map((s) => s.trim())
    .sort();

describe("useStatic — safety and method handling", () => {
  let server: StaticTestServer;
  let port: number;

  beforeAll(async () => {
    // No directoryListing → directories 404 like anything else.
    server = await createStaticServer("/assets", useStatic({ root }));
    port = server.port;
  });

  afterAll(async () => {
    await server.close();
  });

  describe("every miss is an identical 404 that leaks nothing", () => {
    test.each([
      ["decoded parent traversal", "/assets/%2e%2e/%2e%2e/etc/passwd"],
      ["percent-encoded slash traversal", "/assets/sub%2F..%2F..%2Fpasswd"],
      ["NUL byte injection", "/assets/sample.txt%00.png"],
      ["dotfile", "/assets/.hidden.txt"],
      ["directory without listing", "/assets/nested"],
      ["plain missing file", "/assets/nope.txt"],
    ])("%s → 404", async (_label, path) => {
      const res = await rawRequest(port, path);
      const parsed = JSON.parse(res.body.toString());

      expect(res.status).toBe(404);
      expect(parsed.error.code).toBe("static_file_not_found");
      expect(parsed.error.type).toBe("urn:lindorm:pylon:error:static_file_not_found");
      // The offending path never reaches client-visible data.
      expect(parsed.error.data).toEqual({});
      expect(res.body.toString()).not.toContain("passwd");
      expect(res.body.toString()).not.toContain(root);
    });

    test("the 404 error body has a stable shape", async () => {
      const res = await rawRequest(port, "/assets/nope.txt");
      const parsed = JSON.parse(res.body.toString());

      const { id: _id, support: _support, ...error } = parsed.error;
      expect(error).toMatchSnapshot();
    });
  });

  describe("method handling on the subtree", () => {
    test.each(["POST", "PUT", "DELETE"])(
      "%s → 405 with Allow: GET, HEAD",
      async (method) => {
        const res = await rawRequest(port, "/assets/sample.txt", { method });

        expect(res.status).toBe(405);
        expect(sortAllow(res.headers["allow"] as string)).toEqual(["GET", "HEAD"]);
      },
    );

    test("OPTIONS → allowed-methods response advertising GET + HEAD", async () => {
      const res = await rawRequest(port, "/assets/sample.txt", { method: "OPTIONS" });

      expect(res.status).toBe(200);
      expect(sortAllow(res.headers["allow"] as string)).toEqual(["GET", "HEAD"]);
      expect(res.body).toHaveLength(0);
    });
  });
});
