import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import { algToCoseLabel, coseLabelToAlg, isOfficialCoseAlg } from "./alg-labels.js";

describe("alg-labels", () => {
  const pairs = [
    ["ES256", -7],
    ["ES512", -36],
    ["EdDSA", -8],
    ["PS512", -39],
    ["RS256", -257],
    ["HS256", 5],
    ["ML-DSA-65", -49],
  ] as const;

  test.each(pairs)("%s <-> COSE label %i round-trips", (algorithm, label) => {
    expect(algToCoseLabel(algorithm)).toBe(label);
    expect(coseLabelToAlg(label)).toBe(algorithm);
  });

  test("an unmapped label is refused", () => {
    expect(() => coseLabelToAlg(9999)).toThrow(AegisError);
  });

  /**
   * The table is a plain object, so a bare index resolves through
   * `Object.prototype`: `"toString" in JOSE_TO_COSE_OFFICIAL` is TRUE and
   * `JOSE_TO_COSE_OFFICIAL["toString"]` is a FUNCTION, which clears the
   * `=== undefined` guard and reaches the CBOR encoder as an alg label. Read
   * through `own-entry.ts` instead; these rows are what makes that load-bearing.
   *
   * ⚠ MEASURED AT THE FUNCTION, not at a kit door, and that is the honest place:
   * the argument is a `KryptosAlgorithm` off a key, so no token can supply it —
   * this is a config/JS-caller reachability, not a token one. The token-reachable
   * twin of the same table class is `CweKit.decrypt`, pinned in `CweKit.test.ts`.
   */
  const PROTO_NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty"];

  test.each(PROTO_NAMES)("`%s` is not an official COSE algorithm", (name) => {
    expect(isOfficialCoseAlg(name as KryptosAlgorithm)).toBe(false);
  });

  test.each(PROTO_NAMES)("`%s` has no COSE label and is refused", (name) => {
    expect(() => algToCoseLabel(name as KryptosAlgorithm)).toThrow(
      expect.objectContaining({ code: "cose_algorithm_not_supported" }),
    );
  });
});
