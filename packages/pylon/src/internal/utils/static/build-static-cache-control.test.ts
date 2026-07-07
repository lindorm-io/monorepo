import { buildStaticCacheControl } from "./build-static-cache-control.js";
import { describe, expect, test } from "vitest";

describe("buildStaticCacheControl", () => {
  test("defaults to public with max-age=0", () => {
    expect(
      buildStaticCacheControl({ visibility: "public", maxAge: 0, immutable: false }),
    ).toBe("public, max-age=0");
  });

  test("emits the configured max-age in seconds", () => {
    expect(
      buildStaticCacheControl({ visibility: "public", maxAge: 604800, immutable: false }),
    ).toBe("public, max-age=604800");
  });

  test("appends immutable when set", () => {
    expect(
      buildStaticCacheControl({ visibility: "public", maxAge: 3600, immutable: true }),
    ).toBe("public, max-age=3600, immutable");
  });

  test("honours private visibility", () => {
    expect(
      buildStaticCacheControl({ visibility: "private", maxAge: 0, immutable: false }),
    ).toBe("private, max-age=0");
  });

  test("combines private visibility with immutable", () => {
    expect(
      buildStaticCacheControl({ visibility: "private", maxAge: 60, immutable: true }),
    ).toBe("private, max-age=60, immutable");
  });
});
