import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { stripPagination } from "./strip-pagination.js";

const PAGINATED = readFileSync(
  new URL("./__mini__/mini-rfc.txt", import.meta.url),
  "utf8",
);
const PLAIN = readFileSync(
  new URL("./__mini__/mini-rfc-v3.txt", import.meta.url),
  "utf8",
);

describe("stripPagination", () => {
  test("should remove form feeds, page footers and running headers", () => {
    const stripped = stripPagination(PAGINATED);

    expect(stripped).not.toMatch(/\f/);
    expect(stripped).not.toMatch(/\[Page \d+\]/);
    expect(stripped).not.toMatch(/A Mini Fixture Document\s+September 2026/);
    expect(stripped).toMatchSnapshot();
  });

  test("should return an unpaginated document untouched", () => {
    expect(stripPagination(PLAIN)).toBe(PLAIN);
  });
});
