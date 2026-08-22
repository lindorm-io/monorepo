import type { Dict } from "@lindorm/types";
import type { ShapeRuleName, SignContext } from "../types/index.js";

/**
 * The VIOLATIONS a policy-rule exercise needs and cannot DERIVE — pure data, no
 * behaviour, same rule as every other table in `__fixtures__`.
 *
 * Most of the 46 declared policy-rule instances carry their own violation inside
 * the rule: a `required` rule names the claims, so dropping one is the
 * violation; a `forbidden` rule names them, so adding one is; an `atLeastOneOf`
 * rule names the group, so dropping the group is. Those are derived by
 * `run-policy-exercise.ts` off the rule itself and appear NOWHERE here — a
 * derived violation cannot go stale when a profile edits its own list, and a
 * hand-copy would.
 *
 * Three rule kinds carry no violation a machine can read:
 *   - `match` holds a `Condition`, and a value that FAILS a predicate is not
 *     derivable from the predicate.
 *   - `shape` names a validator, and what "malformed" means is the validator's.
 *   - `requiredWhen` holds a `when` FUNCTION, which is opaque by construction.
 *
 * Those three are stated below, and every one of the three tables is bound to
 * the real rule population at runtime by the meta-coverage suite — a violation
 * for a rule nobody declares, or a declared rule with no violation, fails there.
 */

/** One violating input, with the reason it violates. */
export type Violation = {
  /** The DOMAIN-keyed claims to merge over the derived profile baseline. */
  claims: Dict;
  /** Mint-time facts, for the one rule kind that reads them. */
  context?: SignContext;
  /** Why this input violates the rule — read by a human, not by the runner. */
  note: string;
};

/**
 * A violation per `match` CONDITION, keyed by the single domain claim the
 * condition names.
 *
 * Keyed by the CLAIM rather than by the profile: the same condition is declared
 * by nine profiles (`ISSUER_IS_URI`), and one violating value serves all nine.
 * The meta suite derives the key set from the real conditions, so a profile
 * introducing a condition over a new claim fails until a violation exists.
 */
export const MATCH_VIOLATIONS: Readonly<Record<string, Violation>> = {
  issuer: {
    claims: { issuer: "not-a-uri" },
    note: "A bare word carries no scheme, so it fails the URI predicate the profiles hold `iss` to. RFC 7519 §4.1.1, RFC 7519 §2.",
  },
  audience: {
    claims: { audience: ["https://a.lindorm.test", "https://b.lindorm.test"] },
    note: "AEGIS POLICY, not an RFC MUST: an access token resolves to exactly ONE resource, so a two-element audience fails the single-resource predicate. RFC 9068 §3 is the basis and stops short of requiring it; aegis tightens it into a rule.",
  },
};

/**
 * A violation per SHAPE validator. `Record<ShapeRuleName, …>` is TOTAL, so a new
 * shape rule is a COMPILE error here rather than a rule nothing exercises.
 */
export const SHAPE_VIOLATIONS: Readonly<Record<ShapeRuleName, Violation>> = {
  actChain: {
    claims: { act: { subject: 1 } },
    note: "An `act` claim's members identify the actor, and a subject identifier that is not a string identifies nobody: no verifier can match it against a principal, so the token asserts a delegation to a party that cannot be named. ⚠ AN UNDECLARED MEMBER (`{ act: { nested: {} } }`) IS NOT A VIOLATION HERE: the registry declares the actor set OPEN, so every layer carries an undeclared member and such an input would prove a rule enforced when it is not. ⚠ `actChainShape` requires no subject at any depth, so an actor without one is not a violation either. RFC 8693 §4.1, RFC 8693 §4.4.",
  },
  confirmation: {
    claims: { confirmation: { thumbprint: "too-short" } },
    note: "`jkt` is a base64url SHA-256 JWK thumbprint, so a value that does not decode to 32 bytes cannot be one; a verifier comparing it against a real thumbprint would never match, and the token would be treated as bound to a key nobody holds. RFC 9449 §6.1. ⚠ An EMPTY confirmation is deliberately NOT the violation used here — `cnfShape` accepts one, so it would report nothing and the exercise would prove the rule unenforced when it is the input that is wrong.",
  },
  crossField: {
    claims: {
      issuedAt: new Date("2026-06-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    note: "A token that expires before it was issued has no live interval at all. RFC 7519 §4.1.4.",
  },
  events: {
    claims: { events: { "https://schemas.lindorm.test/event/sample": "not-an-object" } },
    note: "The `events` claim is an object whose members are the event payloads, so a scalar payload is not an event. RFC 8417 §2.2.",
  },
  subjectId: {
    claims: { subjectId: { id: "subject_sample" } },
    note: "`format` is what says how the remaining members of a Subject Identifier are read, so one without it cannot be resolved. RFC 9493 §3.",
  },
};

/**
 * A violation per `requiredWhen` instance, keyed `<profile>:<claim>`. The rule's
 * `when` is a FUNCTION, so nothing can derive the branch that makes the claim
 * required; the input that takes that branch is stated here.
 */
export const REQUIRED_WHEN_VIOLATIONS: Readonly<Record<string, Violation>> = {
  "id_token:accessTokenHash": {
    claims: {},
    context: { accessTokenIssued: true },
    note: "When an access token is issued alongside the id token, `at_hash` binds the two; without it the id token cannot vouch for the access token it was issued with. OIDC Core §3.1.3.6.",
  },
};
