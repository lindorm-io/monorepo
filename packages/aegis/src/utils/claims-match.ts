import type { Dict } from "@lindorm/types";
import { createAssertPredicate } from "../internal/utils/create-assert-predicate.js";
import { matches } from "../internal/utils/matches.js";
import type { AssertOptions, DomainAssert } from "../types/index.js";

/**
 * The boolean form of {@link import("./assert-claims.js").assertClaims}: the same
 * claims, matcher and window, answered rather than enforced, for a caller that
 * BRANCHES on the result instead of rejecting the claim set.
 *
 * Outside any deployment, so the temporal window allows no clock tolerance
 * unless `options.clockTolerance` states one; `aegis.matches` is the same check
 * run in a deployment's tolerance.
 */
export const claimsMatch = (
  claims: Dict,
  assert: DomainAssert,
  options?: AssertOptions,
): boolean => matches(claims, createAssertPredicate(assert, options));
