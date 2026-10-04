import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../errors/index.js";
import { createAssertPredicate } from "../internal/utils/create-assert-predicate.js";
import { validate } from "../internal/utils/validate.js";
import type { AssertOptions, DomainAssert } from "../types/index.js";

/**
 * Verify's claim checking, WITHOUT the signature: the same matcher argument
 * (`DomainAssert`) and the same temporal window ({@link AssertOptions})
 * `aegis.verify` applies, run over a flat domain-keyed claim dict that arrived
 * some other way (an introspection response, a cached credential). The temporal
 * range is checked by DEFAULT, in the same window `aegis.verify` applies.
 *
 * Outside any deployment, so the window allows no clock tolerance unless
 * `options.clockTolerance` states one; `aegis.assert` is the same check run in
 * a deployment's tolerance.
 *
 * Throws `AegisDomainError("Invalid token")` under `claims_invalid`, naming
 * every failing top-level key — a root `$and` / `$or` / `$not` under its own
 * key. ⚠ An `AegisDomainError`, never a bare `LindormError`: `instanceof
 * AegisError` is what this package asks consumers to branch on.
 */
export const assertClaims = (
  claims: Dict,
  assert: DomainAssert,
  options?: AssertOptions,
): void =>
  validate(
    claims,
    createAssertPredicate(assert, options),
    AegisDomainError,
    "claims_invalid",
  );
