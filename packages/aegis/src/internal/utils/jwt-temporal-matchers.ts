import { addSeconds, subSeconds } from "@lindorm/date";
import type { PredicateOperator } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import type { JwtClaims } from "../../types/index.js";
import { claimsWith } from "../claims/claims-registry.js";

/**
 * The VALIDATION-temporal claims and their direction, DERIVED from the registry
 * `temporal` marks — the single source of truth. NOT every `value: "date"` claim:
 * `updatedAt` is a date but a profile timestamp, not validation-temporal, so it
 * carries no mark and is absent here. `specsWith` narrows `spec.temporal` to
 * `"past" | "future"` (never `undefined`). (Phase 8's in-kit temporal check
 * derives from the same set.)
 */
const TEMPORAL_SPECS = claimsWith("temporal");

/**
 * The clock-tolerant range bound for a temporal direction (exhaustive; an
 * unhandled direction is a registry/matcher drift and throws). A `"past"` claim
 * (iat/nbf/auth_time) must not be in the future — `value <= now + tolerance`; a
 * `"future"` claim (exp) must not be in the past — `value >= now - tolerance`.
 */
const temporalBound = (
  direction: "past" | "future",
  clockTolerance: number,
): PredicateOperator<any> => {
  switch (direction) {
    case "past":
      return { $lte: addSeconds(new Date(), clockTolerance) };
    case "future":
      return { $gte: subSeconds(new Date(), clockTolerance) };
    default: {
      const exhaustive: never = direction;
      throw new AegisError("Unhandled temporal direction", {
        code: "temporal_unhandled_direction",
        data: { direction: String(exhaustive) },
        title: "Unhandled Temporal Direction",
        details:
          "The claim registry declared a temporal direction the matcher builder has no bound for.",
      });
    }
  }
};

/**
 * Temporal matcher builder (the KIT half — Phase 8 relocates this into JwtKit).
 * Range-checks the registry's temporal claims (`iat`/`nbf`/`exp`/`auth_time`)
 * against "now" with `clockTolerance`. Every claim is validated IF PRESENT: an
 * absent claim is tolerated (the `$exists: false` escape), a PRESENT value is
 * bounded per its direction.
 *
 * `exp` PRESENCE requiredness is NOT decided here — that is policy owned by the
 * identity/presence builder (`createIdentityMatchers`), which drops the
 * `$exists: false` escape on `exp` when a token must carry one. This builder only
 * supplies the clock-tolerant range bound.
 */
export const createTemporalMatchers = (
  clockTolerance: number,
): Partial<Record<keyof JwtClaims, PredicateOperator<any>>> => {
  const predicate: Partial<Record<keyof JwtClaims, PredicateOperator<any>>> = {};

  for (const spec of TEMPORAL_SPECS) {
    predicate[spec.jose as keyof JwtClaims] = {
      $or: [{ $exists: false }, temporalBound(spec.temporal, clockTolerance)],
    };
  }

  return predicate;
};
