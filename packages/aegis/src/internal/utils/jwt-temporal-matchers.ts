import type { ConditionOperator } from "@lindorm/match";
import { addSeconds, subSeconds } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import type { AegisClaimsWire } from "../../types/index.js";
import { type ClaimSpec, claimsWith, joseName } from "../claims/claims-registry.js";

/**
 * The VALIDATION-temporal claims and their direction, DERIVED from the registry
 * `temporal` marks — the single source of truth. NOT every `date` claim:
 * `updatedAt` is a date but a profile timestamp, not validation-temporal, so it
 * carries no mark and is absent here. `claimsWith` narrows `spec.temporal` to
 * `"past" | "future"` (never `undefined`).
 */
const TEMPORAL_SPECS = claimsWith("temporal");

/**
 * The clock-tolerant range bound for a temporal direction (exhaustive; an
 * unhandled direction is a registry/matcher drift and throws). A `"past"` claim
 * (iat/nbf/auth_time) must not be in the future — `value <= now + tolerance`; a
 * `"future"` claim (exp) must not be in the past — `value >= now - tolerance`.
 * `now` is the effective clock — the caller's `currentDate` override or the
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
 * WIRE payload, so it keys by `joseName` (`exp`/`nbf`/`iat`/`auth_time`);
 * `assert` matches a DOMAIN claim dict, so it keys by `spec.domain`
 * (`expiresAt`/`notBefore`/`issuedAt`/`authTime`). Nothing else differs — which
 * is what makes an assert and a verify with the same options answer the same.
 *
 * Every claim is bounded IF PRESENT (the `$exists: false` escape). "now" is
 * `currentDate` when the caller overrides it, otherwise the wall-clock. With
 * `maxTokenAge` (seconds), `iat` gains a lower bound AND becomes required.
 *
 * ⚠ `exp` PRESENCE is not decided here — that is a DOMAIN policy (`expPresence`,
 * enforced Aegis-side). This builder is the single authority on the RANGE.
 *
 * A per-call flag set to `false` (`verifyExpiration`/`verifyNotBefore`/
 * `verifyIssuedAt`/`verifyAuthTime`) drops that claim's bound entirely, so an
 * EXPIRED token verifies while its PRESENCE stays governed by the domain. The
 * `maxTokenAge` iat bound is INDEPENDENT of `verifyIssuedAt`.
 */
// The DOMAIN key namespace — the `assert` half of the two namespaces below. It
// is deliberately NOT a `NameSelector`: that type means "which WIRE name", and a
// domain name is not a wire name.
const domainName = (spec: ClaimSpec): string => spec.domain;

const buildTemporalMatchers = (
  nameOf: (spec: ClaimSpec) => string,
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
    if (skipByClaim[joseName(spec)]) continue;
    // `$or: [{ $exists: false }, bound]` is how the condition language spells
    // OPTIONAL, and that is what this needs: a claim is range-checked only when
    // it is present. A plain bound would REQUIRE it — a null or absent value
    // with a comparison operator does not match — so `nbf`/`auth_time`, which
    // most tokens omit, would start failing verification.
    predicate[nameOf(spec)] = {
      $or: [{ $exists: false }, temporalBound(spec.temporal, clockTolerance, now)],
    };
  }

  // The token's `iat` must be within `maxTokenAge` seconds of now. `iat` is
  // already upper-bounded above; this adds the lower bound AND requires presence —
  // every operator in one object must hold, so the three sit side by side.
  if (maxTokenAge !== undefined) {
    const issuedAt = TEMPORAL_SPECS.find((spec) => joseName(spec) === "iat");

    if (issuedAt === undefined) {
      throw new AegisError("Missing temporal claim: iat", {
        code: "temporal_missing_issued_at",
        title: "Missing Temporal Claim",
        details:
          "maxTokenAge bounds the issued-at claim, but the registry declares no temporal iat claim to bound.",
      });
    }

    predicate[nameOf(issuedAt)] = {
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
  buildTemporalMatchers(joseName, options);

/** The DOMAIN-keyed twin — what `Aegis.assert` runs over a flat claim dict. */
export const createDomainTemporalMatchers = (
  options: TemporalMatcherOptions,
): Dict<ConditionOperator<any>> => buildTemporalMatchers(domainName, options);
