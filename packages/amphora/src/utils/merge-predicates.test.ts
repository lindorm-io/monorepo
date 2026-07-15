import { describe, expect, test } from "vitest";
import type { AmphoraPredicate } from "../types/index.js";
import { applyKeyFloor, mergePredicates } from "./merge-predicates.js";

describe("mergePredicates", () => {
  test("merges layers, later wins", () => {
    expect(mergePredicates({ algorithm: "ES256" }, { algorithm: "RS256" })).toEqual({
      algorithm: "RS256",
    });
  });

  test("a later layer's undefined does NOT erase an earlier layer's real value", () => {
    expect(
      mergePredicates({ algorithm: "ES256" }, { algorithm: undefined }).algorithm,
    ).toBe("ES256");
  });

  test("an undefined value is stripped, never surviving as match-all", () => {
    expect(mergePredicates({ algorithm: undefined })).toEqual({});
    expect("algorithm" in mergePredicates({ algorithm: undefined })).toBe(false);
  });

  test("skips undefined layers", () => {
    expect(mergePredicates(undefined, { publish: false }, undefined)).toEqual({
      publish: false,
    });
  });

  test("returns a fresh object, mutating no layer", () => {
    const first: AmphoraPredicate = { algorithm: "ES256" };
    const merged = mergePredicates(first, { publish: false });

    expect(merged).not.toBe(first);
    expect(first).toEqual({ algorithm: "ES256" });
  });

  test("returns an empty object for no layers", () => {
    expect(mergePredicates()).toEqual({});
  });
});

describe("applyKeyFloor", () => {
  test("a caller layer CANNOT override a floor key", () => {
    expect(applyKeyFloor({ use: "sig" }, { use: "enc" }).use).toBe("sig");
  });

  test("the floor wins over every caller layer", () => {
    expect(applyKeyFloor({ use: "sig" }, { use: "enc" }, { use: "enc" })).toEqual({
      use: "sig",
    });
  });

  test("an undefined caller value is stripped, not match-all", () => {
    const merged = applyKeyFloor({ use: "sig" }, { algorithm: undefined });

    expect("algorithm" in merged).toBe(false);
    expect(merged).toEqual({ use: "sig" });
  });

  test("a caller value on a non-floor key survives", () => {
    expect(applyKeyFloor({ use: "sig" }, { algorithm: "ES256" })).toEqual({
      use: "sig",
      algorithm: "ES256",
    });
  });

  test("a later caller undefined does NOT erase an earlier caller value under the floor", () => {
    const merged = applyKeyFloor(
      { use: "enc" },
      { algorithm: "ES256" },
      { algorithm: undefined },
    );

    expect(merged.algorithm).toBe("ES256");
    expect(merged.use).toBe("enc");
  });

  test("a per-call undefined does not erase a deployment allowlist under the floor", () => {
    const deploymentAllowlist: AmphoraPredicate = {
      algorithm: { $in: ["ES256", "ES384"] },
    };

    const merged = applyKeyFloor({ use: "sig" }, deploymentAllowlist, {
      algorithm: undefined,
    });

    expect(merged.algorithm).toEqual({ $in: ["ES256", "ES384"] });
    expect(merged.use).toBe("sig");
  });
});
