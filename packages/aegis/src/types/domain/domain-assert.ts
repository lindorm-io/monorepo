import type { Predicate, PredicateOperator } from "@lindorm/types";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";

/**
 * The trimmed domain matcher set (DESIGN §6 — the 25 → 8 audit). This is the
 * `assert` matcher vocabulary consumed by `aegis.verify(token, assert, options)`.
 *
 * Only the eight claims that earn a NAMED slot through NON-equality semantics
 * survive as matchers:
 *
 * - `audience` — the token `aud` (string OR array) must CONTAIN this single
 *   identity string (contains-self, not equals).
 * - `issuer` — the token `iss` must EQUAL this (identity).
 * - `scope`/`authMethods`/`roles`/`permissions`/`groups`/`entitlements` —
 *   array-contains: a bare `string`/`Array<string>` requires ALL listed values
 *   present; a `PredicateOperator` (`{ $in }`) matches any.
 *
 * The other 14 former matchers (`authContextClassReference`, `authorizedParty`,
 * `grantType`, `nonce`, `levelOfAssurance`, `vectorOfTrust`, `vectorTrustMark`,
 * `authTime`, `clientId`, `subject`, `subjectHint`, `tenantId`, `authFactor`,
 * `sessionHint`) are plain-equality claims and fold into the free
 * {@link DomainAssert} predicate — each is a `keyof DomainClaims`, so
 * `Predicate<Omit<DomainClaims, keyof DomainClaimMatchers>>` types them. The
 * three verify-time derive-inputs (`accessToken`, `authCode`, `authState`) move
 * to verify OPTIONS ({@link import("./jwt-verify.js").VerifyOptions}).
 */
export type DomainClaimMatchers = {
  audience?: string;
  issuer?: string;
  scope?: string | Array<string> | PredicateOperator<Array<string>>;
  authMethods?: string | Array<string> | PredicateOperator<Array<string>>;
  roles?: string | Array<string> | PredicateOperator<Array<string>>;
  permissions?: string | Array<string> | PredicateOperator<Array<string>>;
  groups?: string | Array<string> | PredicateOperator<Array<string>>;
  entitlements?: string | Array<string> | PredicateOperator<Array<string>>;
};

/**
 * The domain `assert` argument (DESIGN §5b) — the domain twin of the raw kit's
 * `Predicate<WireClaims>`: the eight named {@link DomainClaimMatchers} PLUS a
 * plain predicate over every OTHER domain claim (the folded-in equality claims).
 */
export type DomainAssert = DomainClaimMatchers &
  Predicate<Omit<DomainClaims, keyof DomainClaimMatchers>>;
