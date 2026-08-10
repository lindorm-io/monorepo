import type { Condition, ConditionOperator } from "@lindorm/match";
import type { TokenType } from "../../constants/token-type.js";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";

/**
 * The trimmed domain matcher set (DESIGN §6 — the 25 → 8 audit). This is the
 * `assert` matcher vocabulary consumed by `aegis.verify(token, assert, options)`.
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
 * The four matchers that assert something about the TOKEN rather than the value
 * of a claim the registry names — which is why each needs its own named slot
 * instead of folding into the free claim predicate.
 *
 * - `tokenType` — the token IS of this type. A JWT carries that in its `typ`
 *   header (`application/at+jwt`), a CWT in the COSE `typ` (label 16, RFC 9596
 *   — `application/at+cwt`), and a flat claim dict as a plain `tokenType` field
 *   (an introspection response). One assertion, checked where each surface
 *   keeps it.
 * - `accessToken`/`authCode`/`authState` — the RAW value whose SHA left half
 *   must equal the token's `at_hash` / `c_hash` / `s_hash` (OIDC Core §3.1.3.6
 *   and §3.3.2.11, and the financial-grade `s_hash`). The source is hashed with
 *   the token's own signing algorithm, never compared literally — so the option
 *   key deliberately differs from the claim it lands in.
 */
export type DomainTokenMatchers = {
  tokenType?: TokenType;
  accessToken?: string;
  authCode?: string;
  authState?: string;
};

/**
 * The domain `assert` argument (DESIGN §5b) — the domain twin of the raw kit's
 * `Condition<WireClaims>`: the eight named {@link DomainClaimMatchers}, the four
 * {@link DomainTokenMatchers}, PLUS a plain predicate over every OTHER domain
 * claim (the folded-in equality claims).
 */
export type DomainAssert = DomainClaimMatchers &
  DomainTokenMatchers &
  Condition<Omit<DomainClaims, keyof DomainClaimMatchers>>;
