import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { coseStructureTag } from "./cose-structure-tag.js";
import { COSE_TAG } from "./structures.js";

const DETAILS = "no COSE integrity structure applies.";

describe("coseStructureTag", () => {
  test("an ASYMMETRIC key implies a COSE_Sign1 (tag 18)", () => {
    expect(
      coseStructureTag({ algClass: "asymmetric", error: CwsError, details: DETAILS }),
    ).toBe(COSE_TAG.sign1);
  });

  test("a SYMMETRIC key implies a COSE_Mac0 (tag 17)", () => {
    // The whole integrity split, decided by the key class alone. RFC 9052 §6.3.
    expect(
      coseStructureTag({ algClass: "symmetric", error: CwsError, details: DETAILS }),
    ).toBe(COSE_TAG.mac0);
  });

  test("the two tags are DISTINCT — the split is not a formality", () => {
    expect(COSE_TAG.sign1).not.toBe(COSE_TAG.mac0);
  });

  test("an unhandled class throws under the CALLER's leaf class and words", () => {
    // The `never` backstop: `KryptosAlgClass` is a closed two-member union, so only
    // a runtime surprise reaches it. Each call site answers in its own words, which
    // is why `error` and `details` are theirs to supply.
    const unhandled = "quantum" as unknown as "asymmetric";

    expect(() =>
      coseStructureTag({ algClass: unhandled, error: CwsError, details: DETAILS }),
    ).toThrow(
      expect.objectContaining({
        code: "cose_unhandled_alg_class",
        data: { algClass: "quantum" },
      }),
    );

    expect(() =>
      coseStructureTag({
        algClass: unhandled,
        error: CoseError,
        details: "no COSE claims kit applies.",
      }),
    ).toThrow(CoseError);
  });
});
