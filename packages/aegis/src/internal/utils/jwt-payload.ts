import { B64 } from "@lindorm/b64";
import { snakeKeys } from "@lindorm/case";
import { expires } from "@lindorm/date";
import { isFinite, isObject, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { JwtError } from "../../errors/index.js";
import type {
  JwtClaims,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
  TokenProfile,
} from "../../types/index.js";
import { domainToJose } from "../claims/translate.js";
import { B64U } from "../constants/format.js";
import { applyOmit, type OmitMode } from "./apply-omit.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { extractAegisProfile } from "./extract-aegis-profile.js";
import { extractDomainClaims } from "./extract-claims.js";
import { extractSensitiveIdentity } from "./extract-sensitive-identity.js";

type Config = {
  algorithm: KryptosAlgorithm;
};

/**
 * The policy-FREE profile the raw domain-mapper tier assembles under: it
 * auto-injects nothing (`iat`/`jti`/`nbf`/`iss`), requires/forbids nothing,
 * sources `iss` per-token, and has no lifetime. Running `assembleCommonClaims`
 * with it performs ONLY the domain envelope resolution + hash derivation the
 * old `mapContentToClaims` did — so `domainToJose` of the result reproduces the
 * old wire claims exactly (proven by the translate parity tests).
 */
const RAW_JWT_PROFILE: TokenProfile = {
  name: "raw",
  typ: { presence: "none" },
  required: [],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: false, jti: false, nbf: false, iss: false },
  issuer: "per-token",
  lifetime: null,
  encryptable: false,
  validate: () => [],
};

type DecodeClaims<C extends Dict = Dict> = JwtClaims & C;

type Result = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  payload: string;
  tokenId: string | undefined;
};

/**
 * Base64url-encode a set of ALREADY-TRANSLATED JOSE wire claims as the JWT
 * payload. Profile and custom claims now flow through `domainToJose` into
 * `claims` (R18 — the translator owns all name/case conversion), so the only
 * thing spread here is the sensitive-identity envelope, which still travels as
 * a single nested top-level claim. Shared by the policy-free `encodeJwtPayload`
 * and the profiled signing path.
 */
export const encodeClaimsPayload = <C extends Dict = Dict>(
  claims: Dict,
  content: Pick<SignJwtContent<C>, "sensitiveIdentity">,
  omit?: OmitMode,
): { payload: string; tokenId: string | undefined } => {
  // AegisSensitiveIdentity travels as a single nested top-level claim
  // (sensitive_identity) so the encryption boundary is visible on the wire.
  // Relying parties MUST only honour this claim when the ID token arrived
  // JWE-encrypted (OIDC Core §13.3). Flattening it onto the wire (and driving
  // it off the registry `sensitive` category) is Phase 13.
  const sensitiveIdentityWire = isObject(content.sensitiveIdentity)
    ? { sensitive_identity: snakeKeys(content.sensitiveIdentity) }
    : {};

  // Emission boundary: the assembled wire dict is pruned of empty claims just
  // before it is serialised, so the JWT stays compact and consistent with the
  // COSE wire, which prunes the same way (see applyOmit). `"empty"` is default.
  const payload = B64.encode(
    JSON.stringify(applyOmit({ ...claims, ...sensitiveIdentityWire }, omit)),
    B64U,
  );

  return { payload, tokenId: isString(claims.jti) ? claims.jti : undefined };
};

/**
 * Policy-free payload encoding for the raw domain-mapper tier. Assembles the
 * DOMAIN-keyed common claims (under the policy-free {@link RAW_JWT_PROFILE}:
 * envelope resolution + hash derivation, no auto-injection), merges the profile
 * claims into that domain layer, and translates the whole set to JOSE wire via
 * the ONE `domainToJose` translator — so name/case conversion (registered,
 * profile, and custom claims alike) is owned Aegis-side, not at the emit
 * boundary. The expiry bundle is only computed when `content.expires` is present.
 */
export const encodeJwtPayload = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): Result => {
  const common = assembleCommonClaims(
    { algorithm: config.algorithm, issuer: null },
    RAW_JWT_PROFILE,
    content as SignJwtContent<C> & { claims?: Dict },
    options,
  );

  // Profile claims join the domain layer so `domainToJose` maps them by the
  // registry (identical wire to the previous `snakeKeys(profile)` spread).
  const claims = domainToJose(
    isObject(content.profile) ? { ...common, ...content.profile } : common,
  );

  const { payload, tokenId } = encodeClaimsPayload<C>(claims, content, options.omit);

  const expiry = content.expires ? expires(content.expires) : undefined;

  return {
    expiresAt: expiry?.expiresAt,
    expiresIn: expiry?.expiresIn,
    expiresOn: isFinite(claims.exp) ? claims.exp : undefined,
    payload,
    tokenId,
  };
};

export const decodeJwtPayload = <C extends Dict = Dict<never>>(
  payload: string,
): DecodeClaims<C> => JSON.parse(B64.toString(payload)) as DecodeClaims<C>;

/**
 * The shared parse gate. Only `iss` is STRUCTURALLY enforced here. `exp` is
 * deliberately NOT required at parse: an RFC 8417 / SSF `security_event` SET
 * carries no `exp` at all (`lifetime: null`), yet must parse — `exp` PRESENCE
 * is POLICY, enforced by the verify floor (finite-lifetime profiles) and by the
 * profile-less `expPresence` matcher (default `"required"`), not by the
 * structural parser. `iat` is likewise NOT required: RFC 7523 §3 makes `exp`
 * mandatory on a client assertion but `iat` only OPTIONAL, so a conformant
 * assertion omitting it must still parse. `iat`/`exp` presence policy belongs
 * to the profile floor (`profile.required`, `profile.lifetime`) or to the
 * caller, not to the parser.
 */
export const parseTokenPayload = <C extends Dict = Dict<never>>(
  decoded: DecodeClaims<C>,
): ParsedJwtPayload<C> => {
  // `iss` must be a NON-EMPTY string. Not a URI: this shared gate also parses RFC
  // 7523 client assertions, whose `iss` is the client_id (an opaque string, not a
  // URL/URN), and per-token profiles like delegation. The platform-issuer URI/exact
  // match is enforced higher up (enforceVerifyFloor checks the token's `iss`
  // against the configured issuer for `issuer: "platform"` profiles). The only bug
  // here was `isString("")` passing — an empty issuer is rejected now.
  if (!isString(decoded.iss) || decoded.iss.length === 0) {
    throw new JwtError("Missing claim: iss", {
      code: "jwt_missing_claim_iss",
      title: "JWT Missing Claim ISS",
      details:
        "The payload has no non-empty string iss claim, which is required to parse a JWT.",
    });
  }

  const { claims: domain, rest } = extractDomainClaims(decoded);
  const { profile, rest: afterProfile } = extractAegisProfile(rest);
  const { sensitiveIdentity, rest: customClaims } =
    extractSensitiveIdentity(afterProfile);

  // ParsedJwtPayload keeps set-valued arrays non-optional with [] defaults.
  // Only `iss` is required at parse (validated above); every other scalar
  // claim is optional — subject/tokenId stay undefined when absent
  // (omitUndefined strips them), never a fabricated "unknown".
  return omitUndefined({
    ...domain,
    // Required field (validated above — iss checked)
    issuer: domain.issuer!,
    // Optional — an absent exp (SET) / iat leaves them undefined (omitUndefined strips)
    expiresAt: domain.expiresAt,
    issuedAt: domain.issuedAt,
    // Non-optional arrays default to []
    audience: domain.audience ?? [],
    authMethods: domain.authMethods ?? [],
    entitlements: domain.entitlements ?? [],
    groups: domain.groups ?? [],
    permissions: domain.permissions ?? [],
    roles: domain.roles ?? [],
    scope: domain.scope ?? [],
    // Optional strings — undefined when the claim is absent (no sentinel)
    subject: domain.subject,
    tokenId: domain.tokenId,
    profile,
    sensitiveIdentity,
    claims: customClaims as C,
  });
};
