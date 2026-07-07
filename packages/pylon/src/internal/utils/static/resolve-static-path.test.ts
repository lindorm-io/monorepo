import { ClientError } from "@lindorm/errors";
import { join, sep } from "path";
import { resolveStaticPath } from "./resolve-static-path.js";
import { describe, expect, test } from "vitest";

const ROOT = sep + join("var", "www", "assets");

describe("resolveStaticPath", () => {
  describe("resolves inside the root", () => {
    test("undefined param → the mount root itself", () => {
      expect(resolveStaticPath(ROOT, undefined)).toBe(ROOT);
    });

    test("single segment", () => {
      expect(resolveStaticPath(ROOT, "sample.txt")).toBe(join(ROOT, "sample.txt"));
    });

    test("nested segments", () => {
      expect(resolveStaticPath(ROOT, "nested/deep.txt")).toBe(
        join(ROOT, "nested", "deep.txt"),
      );
    });

    test("a single trailing slash is tolerated (directory hit)", () => {
      expect(resolveStaticPath(ROOT, "nested/")).toBe(join(ROOT, "nested"));
    });
  });

  describe("rejects with a 404 that never leaks the path", () => {
    test.each([
      ["decoded parent traversal", "../../etc/passwd"],
      ["mid-path traversal", "nested/../../secret"],
      ["current-dir segment", "nested/./deep.txt"],
      ["empty segment", "a//b"],
      ["leading slash (empty first segment)", "/etc/passwd"],
      ["dotfile", ".hidden.txt"],
      ["nested dotfile", "nested/.env"],
      ["NUL byte", "sample.txt\0.png"],
    ])("%s → NotFound", (_label, param) => {
      let thrown: ClientError | undefined;
      try {
        resolveStaticPath(ROOT, param);
      } catch (err) {
        thrown = err as ClientError;
      }

      expect(thrown).toBeInstanceOf(ClientError);
      expect(thrown?.status).toBe(ClientError.Status.NotFound);
      expect(thrown?.code).toBe("static_file_not_found");
      expect(thrown?.type).toBe("urn:lindorm:pylon:error:static_file_not_found");
      // The offending path lives in debug (server logs), never in client data.
      expect(thrown?.data).toEqual({});
    });
  });
});
