import { describe, expect, test } from "vitest";
import { crossField } from "./cross-field.js";

// The common layer is DOMAIN-keyed, so timestamps are Dates (expiresAt/
// issuedAt/notBefore), not Unix-seconds numbers.
const d = (unix: number): Date => new Date(unix * 1000);

describe("crossField", () => {
  test("passes when expiresAt > issuedAt and notBefore <= expiresAt", () => {
    expect(
      crossField({ issuedAt: d(100), notBefore: d(100), expiresAt: d(200) }),
    ).toEqual([]);
  });

  test("ignores absent timestamps", () => {
    expect(crossField({})).toEqual([]);
  });

  test("fails when expiresAt <= issuedAt", () => {
    expect(crossField({ issuedAt: d(200), expiresAt: d(200) })).toMatchSnapshot();
  });

  test("fails when notBefore > expiresAt", () => {
    expect(crossField({ notBefore: d(300), expiresAt: d(200) })).toMatchSnapshot();
  });
});
