import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { getUnixTime } from "@lindorm/date";
import { JwtError } from "../../errors/index.js";
import type {
  JwtClaims,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  TokenProfile,
} from "../../types/index.js";
import { domainToJose, joseToDomain } from "../claims/translate.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { extractAegisProfile } from "./extract-aegis-profile.js";
import { extractSensitiveClaims } from "./extract-sensitive-claims.js";

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

/**
 * Merge the FLAT sensitive-identity fields (registry `category: "sensitive"`)
 * into the DOMAIN layer so `domainToJose` maps each to its individual wire claim
 * (`nationalIdentityNumber` -> `national_identity_number`, …). They are ordinary
 * registered claims — NOT nested under a wrapper (OIDC Core §13.3 is enforced by
 * the mint encryption-forcing + the read-side honor-only-when-encrypted gate,
 * not by a wire envelope).
 */
export const withSensitiveDomain = (
  domain: Dict,
  content: Pick<SignJwtContent, "sensitive">,
): Dict => (isObject(content.sensitive) ? { ...domain, ...content.sensitive } : domain);

/**
 * Assemble the full JOSE WIRE claim dict for the policy-free raw JWT tier
 * (`aegis.jwt.sign`). Resolves the DOMAIN-keyed common claims (envelope +
 * hash derivation, no auto-injection, under {@link RAW_JWT_PROFILE}), merges the
 * profile + FLAT sensitive claims into that domain layer, then translates the
 * whole set to JOSE wire via the ONE `domainToJose` translator (R18 — Aegis owns
 * all name/case conversion). The TRANSFORM-FREE `JwtKit.sign` then serializes the
 * returned dict verbatim.
 */
export const assembleJwtWireClaims = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): Dict => {
  const common = assembleCommonClaims(
    { algorithm: config.algorithm, issuer: null },
    RAW_JWT_PROFILE,
    content as SignJwtContent<C> & { claims?: Dict },
    options,
  );

  const domain = withSensitiveDomain(
    isObject(content.profile) ? { ...common, ...content.profile } : common,
    content,
  );

  return domainToJose(domain);
};

/**
 * Enrich the wire kit's bare `{ token }` into the domain `SignedJwt` — the
 * DOMAIN sugar the transform-free kit no longer computes. The expiry bundle is
 * derived from the wire `exp`, the `tokenId` from the wire `jti`.
 */
export const buildSignedJwt = (
  token: string,
  claims: Dict,
  objectId: string | undefined,
): SignedJwt => {
  const expiresOn =
    typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : undefined;

  return {
    expiresAt: expiresOn !== undefined ? new Date(expiresOn * 1000) : undefined,
    expiresIn: expiresOn !== undefined ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    objectId,
    token,
    tokenId: typeof claims.jti === "string" ? claims.jti : undefined,
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
  encrypted: boolean,
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

  // The ONE `jose -> domain` translator (registry-complete): registered claims
  // resolve to their domain names — surfacing `txn`->`transactionId` / `events`
  // that the old `extractDomainClaims` left in the custom bag — and unregistered
  // custom claims flip snake_case -> camelCase into `custom` (R18).
  const { claims: domain, custom } = joseToDomain(decoded);

  // AegisProfile fields are REGISTERED (registry category "profile"), so the
  // translator resolves them into `domain` (camelCased). Bucket them off —
  // extractAegisProfile matches the camelCase domain names and strips them.
  const { profile, rest: afterProfile } = extractAegisProfile(domain);

  // Sensitive-category claims (registry `category: "sensitive"`) travel FLAT and
  // resolve into `domain` like any other registered claim. Partition them off by
  // category, then honour OIDC Core §13.3: SURFACE them into the sensitive bucket
  // ONLY when the outer token was encrypted (jwe/cwe); on an unencrypted token
  // they are SUPPRESSED — stripped from `domainRest` here and never re-attached,
  // so a flat sensitive claim in cleartext reaches no bucket at all.
  const { sensitive, rest: domainRest } = extractSensitiveClaims(afterProfile);
  const sensitiveIdentity = encrypted ? sensitive : undefined;

  // ParsedJwtPayload keeps set-valued arrays non-optional with [] defaults.
  // Only `iss` is required at parse (validated above); every other scalar
  // claim is optional — subject/tokenId stay undefined when absent
  // (omitUndefined strips them), never a fabricated "unknown".
  return omitUndefined({
    ...domainRest,
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
    claims: custom as C,
  });
};
