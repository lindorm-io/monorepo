import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { DomainClaims } from "../claims/domain/domain-claims.js";

/**
 * The two directions a profile's policy can run in. A rule declares its own,
 * and the ONE enforcer selects by it — which is what makes "this rule runs at
 * mint only" a property of the rule rather than of whichever call site happened
 * to invoke it.
 */
export type Direction = "mint" | "verify";

/**
 * A rule's directions. NON-EMPTY and with NO DEFAULT: a rule that names no
 * direction never runs, and a rule that omits the field would inherit whatever
 * the enforcer felt like. Both are unrepresentable.
 */
export type Directions = readonly [Direction, ...Array<Direction>];

/**
 * Mint-time facts the assembled claims object does not itself carry — facts only
 * the ISSUER has, which is why a rule reading them can only run at mint.
 *
 * ⚠ CLOSED, and that is the point. It was a bare `Dict`, so a rule body reading
 * `ctx.accessTokenIssud` compiled, evaluated `undefined`, and silently did not
 * fire. Every member is declared here, so a misspelling on either side — in a
 * rule's `needs` list or in its `when` body — is a compile error.
 */
export type SignContext = {
  /**
   * Whether an access token was co-issued alongside this token. OIDC Core §3.1.3.6
   * makes `at_hash` OPTIONAL in the code flow; aegis requires it whenever an
   * access token co-issues, and only the issuer knows that.
   */
  accessTokenIssued?: boolean;
};

/** The keys a {@link BoundRule} may declare it reads. */
export type ContextKey = keyof SignContext;

/** A single claim that failed a profile policy rule. */
export type InvalidEntry = {
  key: string;
  message: string;
};

/**
 * The DOMAIN claim keys a profile rule may name. It is `keyof DomainClaims` (so
 * a renamed or misspelled domain claim is a compile error in every profile that
 * names it) plus the two claims that live on the enforced common layer but are
 * NOT members of the parsed `DomainClaims` type: `events` (a SET claim carried
 * under its wire key, RFC 8417/9493) and `token_introspection` (the RFC 9701
 * introspection-response wrapper, a custom claim with no domain alias). Both are
 * still domain vocabulary at mint — only their parse path differs — so listing
 * them here keeps the policy strongly typed without a bare `string` escape hatch.
 */
export type ProfileClaimName = keyof DomainClaims | "events" | "token_introspection";

/**
 * The structural validators a `shape` rule may name. Each is a recursive or
 * cross-field check that a flat `Condition` predicate cannot express; the
 * implementations live behind `SHAPE_RULES`, keyed by these names, so a profile
 * names a rule instead of carrying a function.
 */
export type ShapeRuleName =
  | "actChain"
  | "authorizationDetails"
  | "confirmation"
  | "crossField"
  | "events"
  | "subjectId";

/**
 * A rule that does NOT read the {@link SignContext}. It may therefore run in
 * either direction, and it says which.
 */
type FreeRule<T> = T & { on: Directions };

/**
 * A rule that DOES read the {@link SignContext}. Pinned to `["mint"]` BY THE
 * TYPE — a verifier holds the token and nothing else, so a context-reading rule
 * declared for verify would evaluate an empty bag and silently not fire.
 *
 * `needs` names the context keys the rule reads, and the enforcer asserts every
 * one was supplied. Without it, omitting the context is indistinguishable from
 * supplying it as `false`: the rule does not fire and the token mints anyway.
 */
type BoundRule<T> = T & {
  on: readonly ["mint"];
  needs: readonly [ContextKey, ...Array<ContextKey>];
};

/**
 * ONE declarative policy vocabulary, replacing the six per-direction fields a
 * profile used to carry (`required`, `forbidden`, `atLeastOneOf`, `requiredWhen`,
 * `rules`, `validate`) — each of which was enforced by whichever call site
 * remembered it.
 *
 * - `required`     — every named claim must be present.
 * - `forbidden`    — no named claim may be present.
 * - `atLeastOneOf` — at least one of the named claims must be present.
 * - `match`        — a flat `Condition` over the DOMAIN-keyed claim layer, the
 *                    same predicate vocabulary `assert` / `Aegis.assert` use.
 * - `shape`        — a named structural validator (recursive / cross-field).
 * - `requiredWhen` — a claim is required when a predicate over the claims AND the
 *                    mint context holds. The only context-reading rule, hence the
 *                    only {@link BoundRule}.
 */
export type PolicyRule =
  | FreeRule<{ rule: "required"; claims: ReadonlyArray<ProfileClaimName> }>
  | FreeRule<{ rule: "forbidden"; claims: ReadonlyArray<ProfileClaimName> }>
  | FreeRule<{ rule: "atLeastOneOf"; claims: ReadonlyArray<ProfileClaimName> }>
  | FreeRule<{ rule: "match"; condition: Condition<DomainClaims> }>
  | FreeRule<{ rule: "shape"; shape: ShapeRuleName }>
  | BoundRule<{
      rule: "requiredWhen";
      claim: ProfileClaimName;
      when: (claims: Dict, context: SignContext) => boolean;
    }>;

/**
 * The claims a profile's policy GUARANTEES are present on a VERIFIED token —
 * the type-level reading of its `required` rules, filtered by direction so a
 * mint-only requirement never narrows a verify result.
 */
export type VerifyGuaranteedClaims<R> = R extends {
  rule: "required";
  claims: infer C extends ReadonlyArray<ProfileClaimName>;
  on: infer O extends ReadonlyArray<Direction>;
}
  ? "verify" extends O[number]
    ? C[number]
    : never
  : never;
