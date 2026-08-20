import type { Condition, ConditionOperator } from "@lindorm/match";
import type { TokenType } from "../../constants/token-type.js";
import type { DomainClaims } from "../claims/domain/domain-claims.js";

/**
 * The trimmed domain matcher set — the `assert` matcher vocabulary consumed by
 * `aegis.verify(token, assert, options)`.
 *
 * Only the eight claims that earn a NAMED slot through NON-equality semantics
 * survive as matchers:
 *
 * - `audience` — the token `aud` (string OR array) must CONTAIN this single
 *   identity string (contains-self, not equals). Scalar BY DESIGN.
 * - `issuer` — the token `iss` must EQUAL this, or satisfy the supplied
 *   operator. The operator form is what expresses an OPTIONAL bound
 *   (`{ $or: [{ $exists: false }, { $eq: iss }] }`) — strict where the claim is
 *   guaranteed, tolerant where the wire format makes it optional (RFC 7662).
 * - `scope`/`authMethods`/`roles`/`permissions`/`groups`/`entitlements` —
 *   array-contains: a bare `string`/`Array<string>` requires ALL listed values
 *   present; a `ConditionOperator` (`{ $in }`) matches any.
 *
 * The other 14 former matchers (`authContextClassReference`, `authorizedParty`,
 * `grantType`, `nonce`, `levelOfAssurance`, `vectorOfTrust`, `vectorTrustMark`,
 * `authTime`, `clientId`, `subject`, `subjectHint`, `tenantId`,
 * `authFactorReference`, `sessionHint`) are plain-equality claims and fold into
 * the free {@link DomainAssert} predicate — each is a `keyof DomainClaims`, so
 * `Condition<Omit<DomainClaims, keyof DomainClaimMatchers>>` types them.
 */
export type DomainClaimMatchers = {
  audience?: string;
  issuer?: string | ConditionOperator<string>;
  scope?: string | Array<string> | ConditionOperator<Array<string>>;
  authMethods?: string | Array<string> | ConditionOperator<Array<string>>;
  roles?: string | Array<string> | ConditionOperator<Array<string>>;
  permissions?: string | Array<string> | ConditionOperator<Array<string>>;
  groups?: string | Array<string> | ConditionOperator<Array<string>>;
  entitlements?: string | Array<string> | ConditionOperator<Array<string>>;
};

/**
 * The matcher that asserts something about the TOKEN rather than the value of a
 * claim the registry names — which is why it needs its own named slot instead
 * of folding into the free claim predicate.
 *
 * `tokenType` — the token IS of this type. A JWT carries that in its `typ`
 * header (`application/at+jwt`), a CWT in the COSE `typ` (label 16, RFC 9596 —
 * `application/at+cwt`), and a flat claim dict as a plain `tokenType` field (an
 * introspection response). One assertion, checked where each surface keeps it —
 * so it belongs on BOTH surfaces.
 */
export type DomainTokenMatchers = {
  tokenType?: TokenType;
};

/**
 * The hash-DERIVE matchers — VERIFY-ONLY, and structurally so.
 *
 * Each names the RAW value whose SHA left half must equal the token's
 * `at_hash` / `c_hash` / `s_hash` (OIDC Core §3.1.3.6 and §3.3.2.11, and the
 * financial-grade `s_hash`). The source is HASHED with the token's own signing
 * algorithm, never compared literally — so the matcher key deliberately differs
 * from the claim it lands in.
 *
 * That hashing needs the algorithm, and `alg` is a HEADER parameter, never a
 * claim. `verify` resolves it from the verifying key (`JwtKit.algorithm`,
 * cross-checked against the header); `Aegis.assert` is handed a flat claim DICT
 * — no token, no header — so it has nothing to resolve it from BY
 * CONSTRUCTION. A matcher needing a companion input one surface cannot supply
 * does not belong on that surface, so these live on {@link VerifyAssert} alone.
 *
 * Nothing is lost: `accessTokenHash` / `codeHash` / `stateHash` are ordinary
 * domain claims, so a caller holding an already-computed hash matches it by
 * name on either surface. Only asking `assert` to DERIVE one goes away.
 */
export type DomainHashMatchers = {
  accessToken?: string;
  authCode?: string;
  authState?: string;
};

/**
 * The domain `assert` argument — the domain twin of the raw kit's
 * `Condition<WireClaims>`: the eight named {@link DomainClaimMatchers},
 * {@link DomainTokenMatchers}, PLUS a plain predicate over every OTHER domain
 * claim (the folded-in equality claims). This is the vocabulary BOTH surfaces
 * share, and the whole argument `Aegis.assert` / `Aegis.matches` take.
 */
export type DomainAssert = DomainClaimMatchers &
  DomainTokenMatchers &
  Condition<Omit<DomainClaims, keyof DomainClaimMatchers>>;

/**
 * The positional `assert` argument of `aegis.verify` — {@link DomainAssert}
 * plus the {@link DomainHashMatchers} only a surface holding a key (and thus an
 * algorithm) can evaluate.
 */
export type VerifyAssert = DomainAssert & DomainHashMatchers;
