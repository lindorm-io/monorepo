import type { ConditionOperator } from "@lindorm/match";
import { addSeconds, subSeconds } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
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
 * The per-call temporal window — identical on both key namespaces, because it is
 * the same question asked of the same instants.
 */
export type TemporalMatcherOptions = {
  clockTolerance: number;
  currentDate?: Date;
  maxTokenAge?: number;
  verifyExpiration?: boolean;
  verifyNotBefore?: boolean;
  verifyIssuedAt?: boolean;
  verifyAuthTime?: boolean;
};

/**
 * The temporal RANGE check, in ONE implementation and two key namespaces —
 * exactly the split the identity matchers already have. `verify` matches the
 * WIRE payload, so it keys by `spec.jose` (`exp`/`nbf`/`iat`/`auth_time`);
 * `assert` matches a DOMAIN claim dict, so it keys by `spec.domain`
 * (`expiresAt`/`notBefore`/`issuedAt`/`authTime`). Nothing else differs — which
 * is what makes an assert and a verify with the same options answer the same.
 *
 * Range-checks the registry's temporal claims against "now" with
 * `clockTolerance`. Every claim is validated IF PRESENT: an absent claim is
 * tolerated (the `$exists: false` escape), a PRESENT value is bounded per its
 * direction.
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
const buildTemporalMatchers = (
  naming: "jose" | "domain",
  {
    clockTolerance,
    currentDate,
    maxTokenAge,
    verifyExpiration,
    verifyNotBefore,
    verifyIssuedAt,
    verifyAuthTime,
  }: TemporalMatcherOptions,
): Dict<ConditionOperator<any>> => {
  const now = currentDate ?? new Date();
  const predicate: Dict<ConditionOperator<any>> = {};

  // The flag→claim association is by claim IDENTITY, so it is keyed by the
  // registry's JOSE name in both namespaces; only what is WRITTEN changes. Only
  // the four registry temporal claims carry a flag; any other temporal claim is
  // always bounded.
  const skipByClaim: Dict<boolean> = {
    exp: verifyExpiration === false,
    nbf: verifyNotBefore === false,
    iat: verifyIssuedAt === false,
    auth_time: verifyAuthTime === false,
  };

  for (const spec of TEMPORAL_SPECS) {
    if (skipByClaim[spec.jose]) continue;
    // `$or: [{ $exists: false }, bound]` is how the condition language spells
    // OPTIONAL, and that is what this needs: a claim is range-checked only when
    // it is present. A plain bound would REQUIRE it — a null or absent value
    // with a comparison operator does not match — so `nbf`/`auth_time`, which
    // most tokens omit, would start failing verification.
    predicate[spec[naming]] = {
      $or: [{ $exists: false }, temporalBound(spec.temporal, clockTolerance, now)],
    };
  }

  // maxTokenAge (RFC-style): the token's `iat` must be within `maxTokenAge`
  // seconds of now. `iat` is a "past" claim (already upper-bounded above); this
  // adds the lower bound AND requires presence — every operator in one object
  // must hold, so the three sit side by side as a conjunction.
  if (maxTokenAge !== undefined) {
    const issuedAt = TEMPORAL_SPECS.find((spec) => spec.jose === "iat");

    if (issuedAt === undefined) {
      throw new AegisError("Missing temporal claim: iat", {
        code: "temporal_missing_issued_at",
        title: "Missing Temporal Claim",
        details:
          "maxTokenAge bounds the issued-at claim, but the registry declares no temporal iat claim to bound.",
      });
    }

    predicate[issuedAt[naming]] = {
      $exists: true,
      $lte: addSeconds(now, clockTolerance),
      $gte: subSeconds(now, maxTokenAge + clockTolerance),
    };
  }

  return predicate;
};

/** The WIRE-keyed temporal matchers — what `verify` runs over a JOSE/COSE payload. */
export const createTemporalMatchers = (
  options: TemporalMatcherOptions,
): Partial<Record<keyof AegisClaimsWire, ConditionOperator<any>>> =>
  buildTemporalMatchers("jose", options);

/** The DOMAIN-keyed twin — what `Aegis.assert` runs over a flat claim dict. */
export const createDomainTemporalMatchers = (
  options: TemporalMatcherOptions,
): Dict<ConditionOperator<any>> => buildTemporalMatchers("domain", options);
