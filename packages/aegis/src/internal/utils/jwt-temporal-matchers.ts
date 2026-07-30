import type { ConditionOperator } from "@lindorm/match";
import { addSeconds, subSeconds } from "@lindorm/date";
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
): ConditionOperator<any> => {
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
 * `exp` PRESENCE requiredness is NOT decided here — presence is a DOMAIN policy
 * (`expPresence`, enforced Aegis-side). This builder is the SINGLE authority on
 * the temporal RANGE.
 *
 * Each registry temporal claim's range bound can be individually skipped by its
 * per-call flag (`verifyExpiration`/`verifyNotBefore`/`verifyIssuedAt`/
 * `verifyAuthTime`, default `true`). A flag set to `false` drops that claim's
 * bound entirely — the claim is then neither range-checked nor required here, so
 * an EXPIRED token verifies while its PRESENCE stays governed by the domain. The
 * `maxTokenAge` iat bound is INDEPENDENT of `verifyIssuedAt`: it still applies
 * its own lower bound + presence even when the iat range flag is `false`.
 */
export const createTemporalMatchers = ({
  clockTolerance,
  currentDate,
  maxTokenAge,
  verifyExpiration,
  verifyNotBefore,
  verifyIssuedAt,
  verifyAuthTime,
}: {
  clockTolerance: number;
  currentDate?: Date;
  maxTokenAge?: number;
  verifyExpiration?: boolean;
  verifyNotBefore?: boolean;
  verifyIssuedAt?: boolean;
  verifyAuthTime?: boolean;
}): Partial<Record<keyof AegisClaimsWire, ConditionOperator<any>>> => {
  const now = currentDate ?? new Date();
  const predicate: Partial<Record<keyof AegisClaimsWire, ConditionOperator<any>>> = {};

  // Wire claim → its range flag being explicitly OFF. Only the four registry
  // temporal claims carry a flag; any other temporal claim is always bounded.
  const skipByClaim: Partial<Record<keyof AegisClaimsWire, boolean>> = {
    exp: verifyExpiration === false,
    nbf: verifyNotBefore === false,
    iat: verifyIssuedAt === false,
    auth_time: verifyAuthTime === false,
  };

  for (const spec of TEMPORAL_SPECS) {
    if (skipByClaim[spec.jose as keyof AegisClaimsWire]) continue;
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
