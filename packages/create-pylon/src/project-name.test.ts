import { describe, expect, test } from "vitest";
import { isValidProjectName, parseProjectName } from "./project-name.js";

describe("parseProjectName", () => {
  test("returns a plain name unchanged for both package and directory", () => {
    expect(parseProjectName("my-app")).toEqual({
      packageName: "my-app",
      dirName: "my-app",
    });
  });

  test("keeps the scope on the package name but uses the basename for the directory", () => {
    expect(parseProjectName("@acme/proxy")).toEqual({
      packageName: "@acme/proxy",
      dirName: "proxy",
    });
  });

  test("trims surrounding whitespace", () => {
    expect(parseProjectName("  @acme/proxy  ")).toEqual({
      packageName: "@acme/proxy",
      dirName: "proxy",
    });
  });
});

describe("isValidProjectName", () => {
  test.each(["my-app", "app", "@acme/proxy", "@a/b", "with.dots", "with_under"])(
    "accepts %s",
    (name) => {
      expect(isValidProjectName(name)).toBe(true);
    },
  );

  test.each(["", "  ", "Has Space", "UPPER", "@/missing-scope", "@scope/"])(
    "rejects %s",
    (name) => {
      expect(isValidProjectName(name)).toBe(false);
    },
  );
});
