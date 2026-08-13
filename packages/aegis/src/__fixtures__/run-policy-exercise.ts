import { isDate } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../errors/index.js";
import { CLAIM_SPECS } from "../internal/claims/claims-registry.js";
import { enforcePolicy } from "../internal/profiles/enforce-policy.js";
import type {
  Direction,
  InvalidEntry,
  PolicyRule,
  SignContext,
  TokenProfile,
} from "../types/index.js";
import {
  MATCH_VIOLATIONS,
  REQUIRED_WHEN_VIOLATIONS,
  SHAPE_VIOLATIONS,
  type Violation,
} from "./policy-exercises.js";

/**
 * The POLICY-RULE exercise: one runnable proof per declared policy-rule
 * instance, driven off the profiles themselves.
 *
 * A profile's policy is 46 rule instances of six kinds, and a rule nothing ever
 * violates is indistinguishable from a rule the enforcer forgot: `atLeastOneOf`
 * had exactly one call site, on the mint path, so a logout token naming neither
 * a subject nor a session was refused at issue and accepted on arrival — for
 * years, with the rule sitting in the profile the whole time looking like
 * coverage.
 *
 * ⚠ PROVED BY DIFFERENCE, never by "the violating input is refused". A baseline
 * that already fails for an unrelated reason would make every violation look
 * enforced, so each exercise runs the enforcer TWICE — once on the baseline and
 * once on the violation — and requires the violation to report a failure the
 * baseline did NOT. That is the same shape the knob matrix uses, and for the
 * same reason.
 */

/** The domain-shaped sample the registry declares for a claim, if it has one. */
const SAMPLES: ReadonlyMap<string, unknown> = new Map(
  CLAIM_SPECS.map((spec) => [spec.domain, spec.sample]),
);

/**
 * A stand-in for a claim the registry does not know. Exactly one policy rule
 * names one — `token_introspection`, the RFC 9701 response wrapper, which is a
 * custom claim with no domain alias and therefore no registry entry — and a
 * `required`/`forbidden` exercise only needs the claim to be PRESENT or ABSENT,
 * never well-shaped.
 */
const UNREGISTERED_SAMPLE = { present: true };

const sampleFor = (claim: string): unknown => SAMPLES.get(claim) ?? UNREGISTERED_SAMPLE;

/**
 * The claims bag a profile's own policy says is well-formed, derived from the
 * profile: every claim a `required` rule names, plus one member of every
 * `atLeastOneOf` group.
 *
 * ⚠ Derived, never hand-written. A hand-written baseline goes stale the day a
 * profile edits its required list, and it goes stale SILENTLY — the missing
 * claim simply makes the baseline fail too, which turns every difference on that
 * profile into a comparison of two failures.
 *
 * It is NOT required to pass: the difference is what the exercise reads, so a
 * baseline that fails for its own reasons still yields an honest answer. What it
 * must do is fail for the SAME reasons in both runs.
 */
export const baselineClaimsOf = (profile: TokenProfile): Dict => {
  const claims: Dict = {};

  for (const rule of profile.policy) {
    if (rule.rule === "required") {
      for (const claim of rule.claims) claims[claim] = sampleFor(claim);
    }

    if (rule.rule === "atLeastOneOf") {
      const [first] = rule.claims;
      claims[first] = sampleFor(first);
    }
  }

  return claims;
};

/** The failures the enforcer reports for one input, as the keys it named. */
const invalidKeysOf = (input: {
  claims: Dict;
  context: SignContext;
  direction: Direction;
  profile: TokenProfile;
}): ReadonlyArray<string> => {
  try {
    enforcePolicy({ ...input, format: "jwt" });
    return [];
  } catch (error) {
    // A context-incomplete throw is NOT a policy verdict — it is the enforcer
    // refusing to evaluate at all — so it must never be read as one. Surfacing
    // it names the exercise's own mistake instead of silently counting as the
    // difference the exercise is looking for.
    if (!(error instanceof AegisDomainError) || error.code !== "profile_policy_invalid") {
      throw error;
    }

    const { invalid } = error.data as { invalid: ReadonlyArray<InvalidEntry> };

    return invalid.map((entry) => entry.key);
  }
};

/**
 * EVERY direction an instance is exercised in — one exercise per direction the
 * rule declares, never one for the rule.
 *
 * ⚠ It read `rule.on[0]`, and every one of the declared rule instances lists
 * `"mint"` first, so the whole matrix ran on the mint path and NOTHING ran on
 * verify. That is precisely the shape it exists to catch: a rule declared for
 * both directions and enforced on one is invisible to a matrix that only ever
 * asks about the direction that works, and a relying party then accepts tokens
 * the issuer itself would refuse.
 */
export const directionsOf = (rule: PolicyRule): ReadonlyArray<Direction> => rule.on;

/**
 * A SignContext complete enough for the profile's context-reading rules to
 * evaluate rather than refuse. `requiredWhen` is the only kind that reads one,
 * and the enforcer throws outright for a key it was promised and not given.
 */
const contextFor = (profile: TokenProfile, override?: SignContext): SignContext => {
  const context: SignContext = { ...override };

  for (const rule of profile.policy) {
    if (rule.rule !== "requiredWhen") continue;

    for (const key of rule.needs) {
      if (key in context) continue;
      context[key] = false;
    }
  }

  return context;
};

/**
 * The violation an instance is exercised with — DERIVED from the rule wherever
 * the rule carries enough to derive it, and read from the declared tables only
 * for the three kinds that structurally cannot.
 *
 * A `required` rule yields ONE exercise per claim it names, so a rule listing
 * seven claims is seven proofs and not one.
 */
export const violationsOf = (
  profile: TokenProfile,
  rule: PolicyRule,
): ReadonlyArray<{
  label: string;
  violation: Violation;
  drop: ReadonlyArray<string>;
}> => {
  switch (rule.rule) {
    case "required":
      return rule.claims.map((claim) => ({
        label: `required:${claim}`,
        drop: [claim],
        violation: {
          claims: {},
          note: `the profile requires ${claim}, so a bag without it must be refused`,
        },
      }));

    case "forbidden":
      return rule.claims.map((claim) => ({
        label: `forbidden:${claim}`,
        drop: [],
        violation: {
          claims: { [claim]: sampleFor(claim) },
          note: `the profile forbids ${claim}, so a bag carrying it must be refused`,
        },
      }));

    case "atLeastOneOf":
      return [
        {
          label: `atLeastOneOf:${rule.claims.join("|")}`,
          drop: rule.claims,
          violation: {
            claims: {},
            note: `the profile requires one of [${rule.claims.join(", ")}], so a bag with none must be refused`,
          },
        },
      ];

    case "match": {
      const [claim] = Object.keys(rule.condition);
      const violation = MATCH_VIOLATIONS[claim];

      if (violation === undefined) {
        throw new Error(
          `no declared match violation for the condition over "${claim}" — add one to MATCH_VIOLATIONS`,
        );
      }

      return [{ label: `match:${claim}`, drop: [], violation }];
    }

    case "shape": {
      const violation = SHAPE_VIOLATIONS[rule.shape];

      return [{ label: `shape:${rule.shape}`, drop: [], violation }];
    }

    case "requiredWhen": {
      const key = `${profile.name}:${rule.claim}`;
      const violation = REQUIRED_WHEN_VIOLATIONS[key];

      if (violation === undefined) {
        throw new Error(
          `no declared requiredWhen violation for "${key}" — add one to REQUIRED_WHEN_VIOLATIONS`,
        );
      }

      return [{ label: `requiredWhen:${rule.claim}`, drop: [rule.claim], violation }];
    }

    default: {
      const exhaustive: never = rule;
      throw new Error(`unhandled policy rule ${JSON.stringify(exhaustive)}`);
    }
  }
};

/**
 * Run ONE exercise and return the failure keys the violation added over the
 * baseline. EMPTY means the rule is not enforced in the direction being
 * exercised — which is the whole finding.
 *
 * ⚠ The DIRECTION is an argument, never derived from the rule here: a rule
 * declaring both directions is two exercises, and deriving one direction inside
 * the runner is what left the verify half unrun.
 */
export const runPolicyExercise = (input: {
  direction: Direction;
  profile: TokenProfile;
  rule: PolicyRule;
  violation: Violation;
  drop: ReadonlyArray<string>;
}): ReadonlyArray<string> => {
  const { direction } = input;
  const context = contextFor(input.profile, input.violation.context);

  const baseline = baselineClaimsOf(input.profile);

  const violating: Dict = { ...baseline, ...input.violation.claims };
  for (const claim of input.drop) delete violating[claim];

  const before = invalidKeysOf({
    claims: baseline,
    context: contextFor(input.profile),
    direction,
    profile: input.profile,
  });
  const after = invalidKeysOf({
    claims: violating,
    context,
    direction,
    profile: input.profile,
  });

  const added = new Set(before);

  return after.filter((key) => !added.has(key));
};

/**
 * Whether a registry sample is a live `Date`. Used by the meta suite's
 * serialisability statement: a claim sample MAY be a `Date` (the domain shape of
 * a NumericDate claim is one), and that is the one value in these tables that
 * JSON cannot round-trip.
 */
export const isDateSample = (value: unknown): boolean => isDate(value);
