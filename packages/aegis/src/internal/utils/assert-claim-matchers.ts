import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { TokenFormatTag, VerifyAssert } from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { matcherWireName } from "./matcher-wire-name.js";
import { withSpacedArrays } from "./spaced-wire-arrays.js";
import { validate } from "./validate.js";

/**
 * The caller's claim matchers, judged against a verified token's claims — ONE
 * implementation for every signed token `aegis.verify` reads, claims-bearing or
 * opaque.
 */
export const assertClaimMatchers = ({
  wireClaims,
  algorithm,
  assert,
  format,
  nameOf,
}: {
  /**
   * The WIRE-keyed claim dict the matcher pass reads, with temporal claims as
   * `Date`s; a list claim's string form is lifted off it per call
   * ({@link withSpacedArrays}). Only the key spelling differs between the wires,
   * which is what `nameOf` accounts for.
   */
  wireClaims: Dict;
  /** The algorithm the signature was verified under — what a raw hash source is hashed with. */
  algorithm: KryptosAlgorithm;
  /** The caller's matcher bag, ALREADY less `tokenType` (`verifyToken` asserts that against the type header). */
  assert: VerifyAssert | undefined;
  /**
   * The format the token actually is. ⚠ DIAGNOSTIC, never a branch: the refusal is
   * wire-neutral, so a wire-prefixed code would report a CWT failure as a JWT
   * problem.
   */
  format: TokenFormatTag;
  /** Which wire spelling the matcher predicate is keyed by (`jti` vs `cti`). */
  nameOf: NameSelector;
}): void => {
  // ⚠ `omitUndefined` HERE, not only inside the recursion: the predicate and
  // `domainByWire` below must read ONE bag, and an undefined raw source beside
  // its digest claim would otherwise reach the map and claim the wire name the
  // digest compiled to. pinned: `Aegis.claim-matcher.feature` "a caller leaving
  // the raw source undefined beside a wrong digest claim is refused under the
  // digest claim".
  const matchers = omitUndefined(assert ?? {});

  const predicate = createIdentityMatchers(algorithm, matchers, nameOf);

  /**
   * The caller's own vocabulary, keyed by the wire name each matcher compiled to.
   * Built from the TOP-LEVEL keys of the caller's bag rather than the registry,
   * so it needs no jose/cose branch of its own. `validate` names top-level
   * entries only, so nothing nested is ever looked up here.
   */
  const domainByWire = new Map<string, string>(
    Object.keys(matchers).map((key) => [matcherWireName(key, nameOf) ?? key, key]),
  );

  // ⚠ The catch below owns `validate`'s own refusal ALONE: a shape only the
  // MATCHER refuses (an empty `$and` / `$or`, a `$not` that is not an object)
  // raises `@lindorm/match`'s `TypeError`, which passes as the caller's error.
  // pinned: `Aegis.claim-matcher.feature` "a caller stating a disjunction with no
  // member is answered with the matcher's own error" and "a caller negating a
  // value that is not a condition is answered with the matcher's own error".
  try {
    // ⚠ A list claim's string form — a spaced `scope`, a lone `aud` — is lifted
    // to the list it stands for before the predicate runs
    // ({@link withSpacedArrays}): the caller's containment matcher compiles to a
    // `$all` (`lift-claim-matcher.ts`), which no string satisfies.
    validate(
      withSpacedArrays(wireClaims, nameOf),
      predicate as never,
      AegisDomainError,
      "claims_invalid",
    );
  } catch (err) {
    if (!(err instanceof AegisDomainError) || err.code !== "claims_invalid") throw err;

    const invalid = err.data?.invalid as Array<string> | undefined;

    throw new AegisDomainError("Invalid token", {
      code: "claims_invalid",
      // `data` speaks the CALLER's vocabulary — pylon's HTTP error handler puts it
      // straight in the response body, and the caller stated `tokenId`, which the
      // wire spells `jti` on JOSE and `cti` on COSE. Pinned by
      // `Aegis.claim-matcher.feature` "a refused claim matcher is reported under
      // the domain claim name the caller stated it with".
      // A root operator (`$and` / `$or` / `$not`) names no claim, so it has no
      // wire name and maps to itself in `domainByWire`; every claim key
      // `validate` reports is in the map because `createIdentityMatchers`
      // throws on one it cannot map. The `?? key` is the Map's `| undefined`.
      data: { invalid: invalid?.map((key) => domainByWire.get(key) ?? key) },
      // `debug` stays WIRE-spelled and carries the values. A lifted claim's
      // value is the list ({@link withSpacedArrays}), not the token's own
      // string.
      debug: { format, invalid: err.debug?.invalid },
      title: "Claims Invalid",
      details:
        "One or more claims (such as a verifier-supplied claim) failed the validation predicate.",
    });
  }
};
