import { describe, expect, it } from "vitest";
import { arrayIncludes } from "./array-includes.js";

// A narrow `as const` SUBSET and a WIDER union it lives inside — the exact shape the guard
// exists for (e.g. a small alg allowlist vs the full header-alg union).
const SUBSET = ["HS256", "HS384", "HS512"] as const;
type Subset = (typeof SUBSET)[number];
type Wider = Subset | "ES256" | "EdDSA" | "RS256";

// A PARAMETER is genuinely the wide type — unlike a `const` holding one literal, which
// control-flow narrows to that literal (making `V` the literal and defeating the test). This
// is the real scenario the guard is built for: `assert-alg-class`'s `alg: TokenHeaderAlgorithm`.
const inSubset = (alg: Wider): boolean => arrayIncludes(SUBSET, alg);

const narrowIfMember = (alg: Wider): Subset | null => {
  if (arrayIncludes(SUBSET, alg)) {
    const narrowed: Subset = alg; // compile-time proof: only typechecks if `alg` narrowed
    return narrowed;
  }
  return null;
};

describe("arrayIncludes", () => {
  it("should return true for a member and false for a non-member", () => {
    expect(inSubset("HS256")).toBe(true);
    expect(inSubset("ES256")).toBe(false);
  });

  it("should return false against an empty array", () => {
    expect(arrayIncludes([] as ReadonlyArray<Subset>, "HS256" as Wider)).toBe(false);
  });

  it("should accept a WIDER-typed value against a narrow-subset array WITHOUT a call-site cast", () => {
    // No `as readonly string[]` on SUBSET, no literal cast on the value — the point of the util.
    expect(inSubset("HS384")).toBe(true);
  });

  it("should NARROW the wider value to the subset union on the true branch", () => {
    expect(narrowIfMember("HS512")).toBe("HS512");
    expect(narrowIfMember("RS256")).toBeNull();
  });

  it("should work for non-string element types", () => {
    const CODES = [200, 201, 204] as const;
    const inCodes = (status: number): boolean => arrayIncludes(CODES, status);
    expect(inCodes(201)).toBe(true);
    expect(inCodes(500)).toBe(false);
  });

  it("should reject a value whose type is unrelated to the array element (compile-time constraint)", () => {
    // @ts-expect-error a number is not a supertype of the string-literal elements (T extends V fails).
    arrayIncludes(SUBSET, 123);
  });
});
