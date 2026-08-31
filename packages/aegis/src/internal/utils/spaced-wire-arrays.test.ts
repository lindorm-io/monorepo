import { describe, expect, test } from "vitest";
import { coseName, joseName } from "../claims/claims-registry.js";
import { withSpacedArrays } from "./spaced-wire-arrays.js";

describe("withSpacedArrays", () => {
  test("lifts a spaced wire string to the list it spells, under either selector", () => {
    expect(withSpacedArrays({ scope: "read write" }, joseName)).toEqual({
      scope: ["read", "write"],
    });
    expect(withSpacedArrays({ scope: "read write" }, coseName)).toEqual({
      scope: ["read", "write"],
    });
  });

  test("lifts the empty string to the empty list", () => {
    expect(withSpacedArrays({ scope: "" }, joseName)).toEqual({ scope: [] });
  });

  // `roles` is a STRICT array, so its string form is not a list this helper may
  // invent boundaries for — it rides untouched and fails the matchers as itself.
  test("carries an array, a strict claim's scalar, and every other claim untouched", () => {
    const payload = { scope: ["read"], roles: "admin editor", sub: "user-1" };

    expect(withSpacedArrays(payload, joseName)).toEqual(payload);
  });

  // ⚠ On COSE the matcher bag and the REPORTED wire payload are the SAME
  // object (`internal/wire/cose-token-wire.ts`), so the lift must copy: lifting
  // in place would rewrite the untranslated payload a verify result reports.
  test("leaves the input bag untouched", () => {
    const payload = { scope: "read write", sub: "user-1" };
    const before = structuredClone(payload);

    withSpacedArrays(payload, joseName);

    expect(payload).toEqual(before);
  });
});
