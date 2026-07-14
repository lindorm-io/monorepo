import { describe, expect, test } from "vitest";
import { KryptosError } from "../../errors/index.js";
import type { KryptosType } from "../../types/index.js";
import { calculateAlgClass } from "./alg-class.js";

describe("calculateAlgClass", () => {
  test.each<[KryptosType, string]>([
    ["AKP", "asymmetric"],
    ["EC", "asymmetric"],
    ["OKP", "asymmetric"],
    ["RSA", "asymmetric"],
    ["oct", "symmetric"],
  ])("should classify %s as %s", (type, expected) => {
    expect(calculateAlgClass(type)).toBe(expected);
  });

  // The throwing default is unreachable for every VALID type (asserted above), and
  // is the whole point of the derivation: a sixth key type must fail loudly here
  // rather than be silently classified as asymmetric.
  test("should throw for an unclassified key type", () => {
    expect(() => calculateAlgClass("XYZ" as KryptosType)).toThrow(KryptosError);
  });
});
