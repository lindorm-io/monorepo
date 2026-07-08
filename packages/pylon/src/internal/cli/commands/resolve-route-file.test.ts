import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveRouteFile } from "./resolve-route-file.js";

const dir = join("/tmp", "routes");

describe("resolveRouteFile", () => {
  it("should resolve a simple path to a file", () => {
    expect(resolveRouteFile("/assets", dir)).toEqual({
      filepath: join(dir, "assets.ts"),
      depth: 1,
    });
  });

  it("should resolve a nested path to a file", () => {
    expect(resolveRouteFile("/v1/files", dir)).toEqual({
      filepath: join(dir, "v1", "files.ts"),
      depth: 2,
    });
  });

  it("should convert :param segments to [param]", () => {
    expect(resolveRouteFile("/v1/users/:id", dir)).toEqual({
      filepath: join(dir, "v1", "users", "[id].ts"),
      depth: 3,
    });
  });

  it("should convert *rest segments to [...rest]", () => {
    expect(resolveRouteFile("/v1/files/*path", dir)).toEqual({
      filepath: join(dir, "v1", "files", "[...path].ts"),
      depth: 3,
    });
  });

  it("should resolve a trailing slash to index.ts", () => {
    expect(resolveRouteFile("/v1/users/", dir)).toEqual({
      filepath: join(dir, "v1", "users", "index.ts"),
      depth: 3,
    });
  });
});
