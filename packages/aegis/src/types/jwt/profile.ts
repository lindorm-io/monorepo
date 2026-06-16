import type { Expiry } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { TokenType } from "../../constants/token-type.js";
import type { TokenFormat } from "../../internal/utils/select-encoder.js";
import type { AegisPredicate } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";
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
      | "authContextClass"
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
      | "authContextClass"
      | "authMethods"
      | "authFactor"
      | "levelOfAssurance"
      | "authenticatorAssuranceLevel"
      | "identityAssuranceLevel"
      | "federationAssuranceLevel"
      | "authorizedParty"
      | "vectorOfTrust"
      | "vectorTrustMark"
      | "sensitiveIdentity"
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

export type ClientAssertionContent = Required<
  Pick<SignContent, "issuer" | "subject" | "audience">
> &
  Partial<Pick<SignContent, "expires">>;

export type IntrospectionContent = Required<Pick<SignContent, "audience">> &
  Partial<Pick<SignContent, "claims" | "expires">>;

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
  client_assertion: ClientAssertionContent;
  introspection: IntrospectionContent;
  userinfo: UserinfoContent;
  jarm: JarmContent;
};

/**
 * Mint-time facts the assembled claims object does not itself carry (e.g.
 * "an access token was co-issued", "max_age was requested"). Supplied by the
 * sign caller via {@link ProfileSignOptions.context}; consumed by
 * `requiredWhen`/`validate` in later tasks.
 */
export type SignContext = Dict;

/** A single claim that failed a profile validation rule. */
export type InvalidEntry = {
  key: string;
  message: string;
};

/** The crypto class a profile permits for its signing algorithm (§5). */
export type ProfileAlgClass =
  | "asymmetric"
  | "asymmetric-recommended"
  | "confidential"
  | "fapi";

/**
 * Declarative structural RFC rules a profile opts into. Each flag selects a
 * pure rule from `internal/utils/rules/` that `validateProfileClaims` runs.
 */
export type ProfileRules = {
  actChainShape?: boolean;
  audSingleResource?: boolean;
  authorizationDetailsType?: boolean;
  cnfShape?: boolean;
  crossField?: boolean;
  eventsShape?: boolean;
  issUri?: boolean;
  subIdShape?: boolean;
};

/**
 * Runtime descriptor that enforces a profile's policy. Types erase and are
 * bypassable, so each profile is also a runtime descriptor applied by
 * `buildProfileClaims` (presence/forbid/atLeastOneOf/requiredWhen) and
 * `validateProfileClaims` (structural RFC + crypto rules).
 */
export type TokenProfile = {
  name: string;
  typ: string | null;
  required: Array<string>;
  forbidden: Array<string>;
  requiredWhen: Array<{
    claim: string;
    when: (claims: Dict, ctx: SignContext) => boolean;
  }>;
  atLeastOneOf: Array<Array<string>>;
  autoInject: {
    iat: boolean;
    jti: boolean;
    nbf: boolean;
    iss: boolean;
  };
  issuer: "platform" | "per-token";
  lifetime?: Expiry | null;
  encryptable: boolean;
  algClass?: ProfileAlgClass;
  rules?: ProfileRules;
  validate: (claims: Dict, ctx: SignContext) => Array<InvalidEntry>;
};

export type ProfileSignOptions = SignJwtOptions & {
  context?: SignContext;
  /**
   * Per-call wire encoder. Defaults to `"jwt"`; `"cose"` mints a signed CWT.
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
  encrypt?: {
    kid?: string;
    algorithm?: KryptosEncAlgorithm;
    encryption?: KryptosEncryption;
    predicate?: AegisPredicate;
  };
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
  /**
   * Per-call wire encoder (the COSE seam, T6). Defaults to `"jwt"`; `"cose"`
   * throws `NotSupportedError` until the CBOR/CWT decoder lands.
   */
  format?: TokenFormat;
};

/**
 * Raw / wire tier input. `payload` is a wire-literal. `aegis.sign` accepts a
 * plain object too and JSON-stringifies it before delegating to the JWS path.
 */
export type RawSignInput = {
  bindCertificate?: BindCertificateMode;
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  payload: Buffer | string | Dict;
  tokenType?: TokenType;
};
