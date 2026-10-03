import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { escapeGlob, isLiteralPattern } from "./glob-syntax.js";

const GLOB_CHARACTERS = ["*", "?", "[", "]", "{", "}", "(", ")", "!", "|", '"'];

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, index) =>
  String.fromCharCode(0x20 + index),
);

const DOCUMENTED_GLOB_CHARACTERS = /`([^`]+)`\)? is a literal path/;

describe("isLiteralPattern", () => {
  test("should read a path without glob syntax as literal", () => {
    expect(isLiteralPattern("src/a.wip.feature")).toBe(true);
  });

  test("should read @, + and - outside an extglob as literal", () => {
    expect(isLiteralPattern("src/@scope/a+b-c.feature")).toBe(true);
  });

  test.each(GLOB_CHARACTERS)(
    "should read a pattern carrying %s as a glob",
    (character) => {
      expect(isLiteralPattern(`src/a${character}.feature`)).toBe(false);
    },
  );
});

describe("escapeGlob", () => {
  test("should leave a path without glob syntax unchanged", () => {
    expect(escapeGlob("src/@scope/a+b-c.feature")).toBe("src/@scope/a+b-c.feature");
  });

  test.each([...GLOB_CHARACTERS, "\\"])(
    "should escape %s with a backslash",
    (character) => {
      expect(escapeGlob(`src/a${character}.feature`)).toBe(`src/a\\${character}.feature`);
    },
  );

  test("should escape a leading ! — unescaped, it negates the whole entry", () => {
    expect(escapeGlob("!a.feature")).toBe("\\!a.feature");
  });

  test("should escape every glob character of a path, wherever it stands", () => {
    expect(escapeGlob("src/(draft)/{a,b}[1]?*.feature")).toBe(
      "src/\\(draft\\)/\\{a,b\\}\\[1\\]\\?\\*.feature",
    );
  });
});

describe("the documented glob characters", () => {
  test.each([
    ["README.md", new URL("../../../README.md", import.meta.url)],
    [
      "GherkinSettings.exclude",
      new URL("../../types/gherkin-settings.ts", import.meta.url),
    ],
  ])(
    "should list in %s exactly the characters that make an exclude entry a glob",
    async (_, document) => {
      const listed = DOCUMENTED_GLOB_CHARACTERS.exec(
        await readFile(document, "utf8"),
      )?.[1];

      expect(listed?.split(" ").sort()).toEqual(
        PRINTABLE_ASCII.filter(
          (character) => isLiteralPattern(`src/a${character}.feature`) === false,
        ).sort(),
      );
    },
  );
});
