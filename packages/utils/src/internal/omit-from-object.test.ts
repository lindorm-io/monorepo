import { describe, expect, test } from "vitest";
import { omitFromObject } from "./omit-from-object.js";

const omitUndefinedish = (value: unknown): boolean => value === undefined;

describe("omitFromObject", () => {
  test("should keep the entries the predicate does not omit", () => {
    expect(
      omitFromObject({ kept: "x", dropped: undefined }, omitUndefinedish),
    ).toMatchSnapshot();
  });

  // A dict parsed from untrusted JSON can carry an OWN `__proto__` key —
  // `JSON.parse` creates it as a data property, unlike an object literal. A
  // plain `result[key] = value` would invoke the prototype setter and hand the
  // caller an object whose prototype the attacker chose. Aegis reaches this with
  // every token payload it parses, so the hostile value is a real input.
  test("should not let an own __proto__ key set the result's prototype", () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":"yes"},"sub":"alice"}');

    expect(Object.hasOwn(hostile, "__proto__")).toBe(true);

    const result = omitFromObject(hostile, omitUndefinedish);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(
      (Object.getPrototypeOf(result) as { polluted?: string }).polluted,
    ).toBeUndefined();
  });

  // The key is DATA, not a directive — dropping it would be a silent loss of
  // something the caller handed over, which is the failure this package keeps
  // closing elsewhere.
  test("should preserve an own __proto__ key as an own data property", () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":"yes"},"sub":"alice"}');

    const result = omitFromObject(hostile, omitUndefinedish);

    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.sub).toBe("alice");
  });

  test("should not pollute through a NESTED own __proto__ key", () => {
    const hostile = JSON.parse('{"outer":{"__proto__":{"polluted":"yes"},"a":1}}');

    const result = omitFromObject(hostile, omitUndefinedish);

    expect(Object.getPrototypeOf(result.outer)).toBe(Object.prototype);
  });
});
