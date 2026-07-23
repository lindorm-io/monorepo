import { addSeconds, subSeconds } from "@lindorm/date";
import type { PredicateOperator } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import type { AegisClaimsWire } from "../../types/index.js";
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
 * `now` is the effective clock — the caller's `currentDate` override (R10) or the
 * real wall-clock when none is supplied.
 */
const temporalBound = (
  direction: "past" | "future",
  clockTolerance: number,
  now: Date,
): PredicateOperator<any> => {
  switch (direction) {
    case "past":
      return { $lte: addSeconds(now, clockTolerance) };
    case "future":
      return { $gte: subSeconds(now, clockTolerance) };
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
 * "now" is the effective clock (R10): `currentDate` when the caller overrides it,
 * otherwise the real wall-clock. When `maxTokenAge` (seconds) is supplied, `iat`
 * gains a LOWER bound — `iat >= now - maxTokenAge - clockTolerance` — and becomes
 * REQUIRED (a token with no `iat` cannot prove its age), rejecting a stale token.
 *
 * `exp` PRESENCE requiredness is NOT decided here — that is policy owned by the
 * identity/presence builder (`createIdentityMatchers`), which drops the
 * `$exists: false` escape on `exp` when a token must carry one. This builder only
 * supplies the clock-tolerant range bound.
 */
export const createTemporalMatchers = (
  clockTolerance: number,
  currentDate?: Date,
  maxTokenAge?: number,
): Partial<Record<keyof AegisClaimsWire, PredicateOperator<any>>> => {
  const now = currentDate ?? new Date();
  const predicate: Partial<Record<keyof AegisClaimsWire, PredicateOperator<any>>> = {};

  for (const spec of TEMPORAL_SPECS) {
    predicate[spec.jose as keyof AegisClaimsWire] = {
      $or: [{ $exists: false }, temporalBound(spec.temporal, clockTolerance, now)],
    };
  }

  // maxTokenAge (RFC-style): the token's `iat` must be within `maxTokenAge`
  // seconds of now. `iat` is a "past" claim (already upper-bounded above); this
  // adds the lower bound AND requires presence — a value operator with multiple
  // conditions must be an `$and` (a bare multi-key operator object matches only
  // its FIRST key), so both bounds and presence are enforced together.
  if (maxTokenAge !== undefined) {
    predicate.iat = {
      $and: [
        { $exists: true },
        { $lte: addSeconds(now, clockTolerance) },
        { $gte: subSeconds(now, maxTokenAge + clockTolerance) },
      ],
    };
  }

  return predicate;
};
