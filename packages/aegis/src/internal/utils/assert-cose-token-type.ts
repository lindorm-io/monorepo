import { AegisDomainError } from "../../errors/index.js";
import { coseTyp } from "../cose/cose-typ.js";
import { computeTypHeader } from "./compute-typ-header.js";

/**
 * The `tokenType` assertion, COSE half.
 *
 * `tokenType` asserts the token's TYPE, which both wires keep in a HEADER rather
 * than a claim — so neither wire routes it through the claim matchers. JOSE hands
 * it to the kit, which asserts the `typ` header during verify; COSE has no
 * equivalent kit hook, so the comparison lives here.
 *
 * Derived through the ONE JOSE→COSE typ mapping (`coseTyp`) that mint stamps
 * with, so the two can never disagree about what a given `tokenType` looks like
 * on this wire.
 */
export const assertCoseTokenType = (
  typ: string | undefined,
  tokenType: string | undefined,
): void => {
  if (tokenType === undefined) return;

  const expected = coseTyp({
    presence: "required",
    value: computeTypHeader(tokenType, "jwt"),
  });

  if (typ === expected) return;

  throw new AegisDomainError("Invalid token", {
    code: "cwt_typ_mismatch",
    data: { typ },
    debug: { expected },
    title: "CWT Typ Mismatch",
    details:
      "The COSE typ header does not match the type asserted for this verification.",
  });
};
