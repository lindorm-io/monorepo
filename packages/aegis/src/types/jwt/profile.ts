import type { Expiry } from "@lindorm/date";
import type { KryptosAlgClass } from "@lindorm/kryptos";
import type { Dict, Predicate } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { TokenFormat } from "../../internal/utils/select-encoder.js";
import type { AegisSignKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";
import type { JweEncryptOptions } from "../jwe/jwe-encrypt.js";
import type { SignJwtContent, SignJwtOptions } from "./jwt-sign.js";
import type { VerifyJwtOptions } from "./jwt-verify.js";

/**
 * The single domain vocabulary every profile draws from. All keys are
 * optional; individual profiles narrow this via `Pick`/`Partial` to make
 * required keys non-optional and forbidden keys absent. Wire claim names
 * never appear here — only domain names.
 */
export type SignContent = Partial<SignJwtContent>;

/**
 * `default` re-imposes the historical floor: `subject` and `expires` are
 * mandatory, everything else optional.
 */
export type DefaultContent = Required<Pick<SignContent, "subject" | "expires">> &
  Partial<Omit<SignContent, "subject" | "expires">>;

/**
 * Per-profile input types. Each makes its REQUIRED domain keys non-optional
 * (compile error if omitted) and leaves the rest optional. Forbidden wire
 * claims have no domain key here, so they cannot be expressed. `exp` is
 * derived from the profile lifetime, so `expires` is optional everywhere it is
 * not the historical floor.
 */
export type AccessTokenContent = Required<
  Pick<SignContent, "subject" | "audience" | "clientId">
> &
  Partial<
    Pick<
      SignContent,
      | "scope"
      | "confirmation"
      | "act"
      | "mayAct"
      | "authorizationDetails"
      | "roles"
      | "permissions"
      | "groups"
      | "entitlements"
      | "sessionId"
      | "authTime"
      | "authContextClassReference"
      | "authMethods"
      | "authFactor"
      | "levelOfAssurance"
      | "authenticatorAssuranceLevel"
      | "identityAssuranceLevel"
      | "grantType"
      | "sessionHint"
      | "subjectHint"
      | "expires"
      | "vectorOfTrust"
      | "vectorTrustMark"
      | "conformsTo"
    >
  >;

export type IdTokenContent = Required<Pick<SignContent, "subject" | "audience">> &
  Partial<
    Pick<
      SignContent,
      | "accessToken"
      | "authCode"
      | "authState"
      | "authTime"
      | "nonce"
      | "sessionId"
      | "authContextClassReference"
      | "authMethods"
      | "authFactor"
      | "levelOfAssurance"
      | "authenticatorAssuranceLevel"
      | "identityAssuranceLevel"
      | "federationAssuranceLevel"
      | "authorizedParty"
      | "vectorOfTrust"
      | "vectorTrustMark"
      | "sensitive"
      | "profile"
      | "expires"
    >
  >;

export type LogoutTokenContent = Required<Pick<SignContent, "audience" | "events">> &
  Partial<Pick<SignContent, "subject" | "sessionId" | "expires">>;

export type ErasureTokenContent = Required<
  Pick<SignContent, "audience" | "subject" | "events">
> &
  Partial<Pick<SignContent, "expires">>;

export type SecurityEventContent = Required<
  Pick<SignContent, "audience" | "subjectId" | "events">
> &
  Partial<Pick<SignContent, "transactionId">>;

export type DelegationContent = Required<
  Pick<SignContent, "issuer" | "subject" | "audience">
> &
  Partial<Pick<SignContent, "expires">>;

export type IntrospectionContent = Required<Pick<SignContent, "audience">> &
  Partial<Pick<SignContent, "claims" | "expires" | "conformsTo">>;

export type UserinfoContent = Required<Pick<SignContent, "subject" | "audience">> &
  Partial<Pick<SignContent, "profile" | "claims" | "expires">>;

export type JarmContent = Required<Pick<SignContent, "audience">> &
  Partial<Pick<SignContent, "claims" | "expires">>;

/**
 * Maps each built-in profile name to its input content type. Used by the
 * typed `mint` overload so the compiler enforces required/forbidden claims.
 */
export type ProfileContent = {
  default: DefaultContent;
  access_token: AccessTokenContent;
  id_token: IdTokenContent;
  logout_token: LogoutTokenContent;
  erasure_token: ErasureTokenContent;
  security_event: SecurityEventContent;
  delegation: DelegationContent;
  introspection: IntrospectionContent;
  userinfo: UserinfoContent;
  jarm: JarmContent;
};

/**
 * Mint-time facts the assembled claims object does not itself carry (e.g.
 * "an access token was co-issued", "max_age was requested"). Supplied by the
 * mint caller via {@link ProfileMintOptions.context}; consumed by
 * `requiredWhen`/`validate` in later tasks.
 */
export type SignContext = Dict;

/** A single claim that failed a profile validation rule. */
export type InvalidEntry = {
  key: string;
  message: string;
};

/**
 * The DOMAIN claim keys a profile may name in its `required`/`forbidden`
 * floor. It is `keyof DomainClaims` (so a typo in a domain claim name is a
 * compile error) plus the two claims that live on the enforced common layer
 * but are NOT members of the parsed `DomainClaims` type: `events` (a SET claim
 * carried under its wire key, RFC 8417/9493) and `token_introspection` (the
 * RFC 9701 introspection-response wrapper, a custom claim with no domain
 * alias). Both are still domain vocabulary at mint — only their parse path
 * differs — so listing them here keeps the floor strongly typed without a bare
 * `string` escape hatch.
 */
export type ProfileClaimName = keyof DomainClaims | "events" | "token_introspection";

/**
 * The envelope claims a profile may auto-generate at mint. Constrained to the
 * four mint-GENERATABLE domain claims — replacing the previous
 * `{ iat; jti; nbf; iss }` object whose WIRE names leaked into the profile
 * descriptor. The mint pipeline maps each to its wire claim via the ONE
 * translator (`issuedAt`→`iat`, `tokenId`→`jti`, `notBefore`→`nbf`,
 * `issuer`→`iss`).
 */
export type AutoInjectableClaim = "issuedAt" | "tokenId" | "notBefore" | "issuer";

/**
 * The profile's JOSE `typ` header policy — a discriminated union on `presence`:
 *
 * - `"none"` — the profile mandates no typ. Mint falls back to the
 *   tokenType-derived default (bare `JWT`); verify runs no typ check.
 * - `"required"` — mint stamps `value`; verify rejects an absent or
 *   mismatching typ (RFC 8725 explicit typing).
 *
 * Presence is a verify-side knob only: mint always stamps `value` for
 * `"required"`.
 */
export type TokenProfileTyp =
  | { presence: "none" }
  | { presence: "required"; value: string };

/**
 * Runtime descriptor that enforces a profile's policy. Types erase and are
 * bypassable, so each profile is also a runtime descriptor applied by
 * `buildProfileClaims` (presence/forbid/atLeastOneOf/requiredWhen) and
 * `validateProfileClaims` (structural RFC + crypto rules).
 */
export type TokenProfile<
  R extends ReadonlyArray<ProfileClaimName> = ReadonlyArray<ProfileClaimName>,
> = {
  name: string;
  typ: TokenProfileTyp;
  required: R;
  forbidden: ReadonlyArray<ProfileClaimName>;
  requiredWhen: Array<{
    claim: string;
    when: (claims: Dict, ctx: SignContext) => boolean;
  }>;
  atLeastOneOf: Array<Array<string>>;
  /**
   * The envelope claims mint auto-generates, by DOMAIN name. Membership is
   * checked with `.includes(...)` in the mint pipeline (was a per-flag object;
   * see {@link AutoInjectableClaim}).
   */
  autoInject: ReadonlyArray<AutoInjectableClaim>;
  issuer: "platform" | "per-token";
  lifetime?: Expiry | null;
  encryptable: boolean;
  /**
   * The artifact's own opinion on the class of key that may sign it. Part of
   * the signing FLOOR, so it CONSTRAINS the key query rather than merely
   * auditing its answer — and it is enforced on an injected key too.
   *
   * In practice only `"asymmetric"` (access_token, delegation). Absent means no
   * constraint: with `alg: none` not being a Kryptos algorithm, "asymmetric or
   * HS*" is the whole algorithm space.
   */
  algClass?: KryptosAlgClass;
  /**
   * Flat structural rules expressed as a `Predicate<DomainClaims>` over the
   * DOMAIN-keyed common layer — the SAME predicate vocabulary `assert` /
   * matchers / `validateClaims` use. `validateProfileClaims` evaluates it and
   * throws `jwt_claims_invalid` on a mismatch. Only rules a flat predicate can
   * express live here (`issUri`, `audSingleResource`); genuinely recursive or
   * cross-field rules (`crossField`, `actChainShape`, `cnfShape`, `subIdShape`,
   * `eventsShape`, `authorizationDetails` element shape) stay in `validate`.
   */
  rules?: Predicate<DomainClaims>;
  /**
   * The imperative escape hatch for rules a flat predicate cannot express
   * (recursive / cross-field / structured). Composed from the pure
   * `internal/utils/rules/*` functions and run after `rules` by
   * `validateProfileClaims`.
   */
  validate: (claims: Dict, ctx: SignContext) => Array<InvalidEntry>;
};

export type ProfileMintOptions = {
  /**
   * The signed JWT: its envelope options (`header`, `typ`, hash claims, …) and
   * its own per-call signing key (`sign.key`).
   */
  sign?: SignJwtOptions;
  /**
   * The sign-then-encrypt wrapper: its envelope options and the recipient
   * (client) encryption key (`encrypt.key`). Pin it with
   * `{ key: { predicate: { id } } }`, target a client with
   * `{ key: { predicate: { ownerId: client.id } } }`, or supply one outright
   * with `{ key: { kryptos } }`. Only meaningful for an encryptable profile;
   * its presence forces encryption on.
   */
  encrypt?: JweEncryptOptions;
  /**
   * Per-call token lifetime, overriding the profile's default `lifetime`. An
   * explicit `content.expires` (an absolute instant) still wins over this; with
   * neither set the profile default applies, and a `null` profile default with
   * no override yields no `exp`.
   */
  lifetime?: Expiry;
  context?: SignContext;
  /**
   * Per-call wire encoder. Defaults to `"jwt"` (a signed JWT); `"cwt"` mints the
   * COSE counterpart — a signed CWT (COSE_Sign1 / COSE_Mac0), optionally wrapped
   * in a COSE_Encrypt0. Applies to the whole pipeline.
   */
  format?: TokenFormat;
  /**
   * Use compact private-use integer COSE labels (default `true`): claims with a
   * private-use label and the structured `act`/`subjectId` are keyed by their
   * compact integer form on-platform. Set `false` for off-platform tokens —
   * those claims are emitted under their JOSE string key instead (interoperable,
   * never dropped), and `act`/`subjectId` become string-keyed objects. (COSE
   * only.)
   */
  proprietary?: boolean;
  /**
   * How empty claims are pruned before the token is emitted, threaded into both
   * the JOSE and COSE wires so a single `mint` call controls both identically.
   * `"empty"` (default) drops null/empty-string/empty-array/empty-object
   * recursively; `"undefined"` drops only undefined.
   */
  omit?: OmitMode;
};

/**
 * Options for profiled verify. Beyond the standard verify matchers, the floor
 * (§4.4) needs the verifier's own identity (`audience`) to assert the token's
 * `aud` contains self. `issuer` may override the configured/profile issuer
 * source (per-token profiles).
 */
export type ProfileVerifyOptions = VerifyJwtOptions & {
  audience: string;
  issuer?: string;
  clockTolerance?: number;
  // No `format` — unlike mint, verify is NOT told the wire encoding. It detects
  // COSE vs JOSE from the token itself (`Aegis.isCose`), so a caller never has to
  // know, or match, a token's format to verify it.
};

/**
 * Raw / wire tier input. `payload` is a wire-literal. `aegis.sign` accepts a
 * plain object too and JSON-stringifies it before delegating to the JWS path.
 */
export type RawSignInput = {
  bindCertificate?: BindCertificateMode;
  contentType?: string;
  /**
   * Wire encoding. `"jws"`/`"jwt"` (default) signs a JWS — the payload passes through as
   * bytes. `"cws"` signs a secured CWT (COSE_Sign1) over the CBOR-encoded payload, which
   * MUST then be a plain object; the token is base64url CBOR with no JOSE dot structure, so
   * it cannot be mistaken for — or parsed as — a JWT. `verify` auto-detects either format.
   * The `cws` namespace is the ergonomic surface over `sign({ format: "cws" })`.
   */
  format?: TokenFormat;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  payload: Buffer | string | Dict;
  /** Per-call signing key policy. */
  key?: AegisSignKey;
  /**
   * How empty claims are pruned before signing, applied only when `payload` is
   * a plain object (a Buffer/string payload is opaque and passes through
   * untouched). `"empty"` (default) drops null/empty-string/empty-array/
   * empty-object recursively; `"undefined"` drops only undefined.
   */
  omit?: OmitMode;
  tokenType?: TokenType;
};
