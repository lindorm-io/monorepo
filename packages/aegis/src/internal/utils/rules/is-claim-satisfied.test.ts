import { describe, expect, test } from "vitest";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

describe("isClaimSatisfied", () => {
  test("a value a demand can bite on is satisfied", () => {
    expect(isClaimSatisfied("sub_1")).toBe(true);
    expect(isClaimSatisfied(["https://api.lindorm.test"])).toBe(true);
    expect(isClaimSatisfied({ keyId: "key_1" })).toBe(true);
  });

  // A container's empty form is the half the single predicate this replaces
  // could not see: it counted `undefined | null | ""` only.
  test.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["empty array", []],
    ["empty object", {}],
  ])("%s is not something to bite on", (_label, value) => {
    expect(isClaimSatisfied(value)).toBe(false);
  });

  // `0` and `false` are VALUES. A `loa: 0` states a level of assurance and an
  // `email_verified: false` states a verification result.
  test.each([
    ["zero", 0],
    ["false", false],
  ])("%s is a value, not an absence", (_label, value) => {
    expect(isClaimSatisfied(value)).toBe(true);
  });

  // `isEmpty` reads own keys and is prototype-based, so every temporal claim
  // stays satisfiable — `required: ["expiresAt"]` would otherwise refuse every
  // token aegis mints.
  test("a Date is satisfied despite carrying no own keys", () => {
    expect(isClaimSatisfied(new Date("2026-08-16T00:00:00.000Z"))).toBe(true);
  });

  /**
   * A BYTE STRING is satisfying at any length, zero included — `@lindorm/is`
   * `isEmpty` declines to answer for a buffer because "empty" there would mean
   * `byteLength`, a different question from an empty container. The registry
   * states the same verdict for the same question ("neither is a zero-length
   * Buffer", `internal/registry/param-spec.ts`).
   *
   * ⚠ Pinned as a statement about `@lindorm/is` BEHAVIOUR and nothing more — no
   * aegis claim is asserted to arrive as a byte string, and none was found to.
   * The pin exists because the predicate's own docblock states this verdict, and
   * without it the underlying `isEmpty` could change and no aegis test would say
   * so.
   */
  test.each([
    ["a zero-length Buffer", Buffer.alloc(0)],
    ["a zero-length Uint8Array", new Uint8Array(0)],
    ["a Buffer with bytes", Buffer.from("tok")],
  ])("%s is satisfying", (_label, value) => {
    expect(isClaimSatisfied(value)).toBe(true);
  });

  // The exotic containers DO have an unambiguous emptiness, and `isEmpty` reads
  // it from `size` — where `Object.keys` would see nothing and call every Map
  // empty.
  test.each([
    ["an empty Map", new Map()],
    ["an empty Set", new Set()],
  ])("%s is not something to bite on", (_label, value) => {
    expect(isClaimSatisfied(value)).toBe(false);
  });
});
