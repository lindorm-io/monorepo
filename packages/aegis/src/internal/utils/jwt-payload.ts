import { B64 } from "@lindorm/b64";
import { snakeKeys } from "@lindorm/case";
import { expires } from "@lindorm/date";
import { isFinite, isObject, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { B64U } from "../constants/format.js";
import { JwtError } from "../../errors/index.js";
import type {
  JwtClaims,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
} from "../../types/index.js";
import { extractAegisProfile } from "./extract-aegis-profile.js";
import { extractDomainClaims } from "./extract-claims.js";
import { extractSensitiveIdentity } from "./extract-sensitive-identity.js";
import { mapContentToClaims } from "./map-content-to-claims.js";

type Config = {
  algorithm: KryptosAlgorithm;
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
 * Spread a profile/sensitive-identity/custom-claims envelope onto a set of
 * already-mapped wire claims and base64url-encode the JSON payload. Shared by
 * the policy-free `encodeJwtPayload` and the profiled signing path.
 */
export const encodeClaimsPayload = <C extends Dict = Dict>(
  claims: Dict,
  content: Pick<SignJwtContent<C>, "claims" | "profile" | "sensitiveIdentity">,
): { payload: string; tokenId: string | undefined } => {
  // AegisProfile fields are spread into the top-level JSON payload via
  // mechanical snake_case conversion. This keeps aegis-signed tokens
  // OIDC-compliant (profile claims like given_name, family_name, etc.
  // live at the top level of the token, not nested under a "profile" key).
  const profileWire = isObject(content.profile) ? snakeKeys(content.profile) : {};

  // AegisSensitiveIdentity travels as a single nested top-level claim
  // (sensitive_identity) so the encryption boundary is visible on the wire.
  // Relying parties MUST only honour this claim when the ID token arrived
  // JWE-encrypted (OIDC Core §13.3).
  const sensitiveIdentityWire = isObject(content.sensitiveIdentity)
    ? { sensitive_identity: snakeKeys(content.sensitiveIdentity) }
    : {};

  const payload = B64.encode(
    JSON.stringify({
      ...claims,
      ...profileWire,
      ...sensitiveIdentityWire,
      ...(content.claims ?? {}),
    }),
    B64U,
  );

  return { payload, tokenId: isString(claims.jti) ? claims.jti : undefined };
};

/**
 * Policy-free payload encoding for the raw domain-mapper tier. Maps the
 * domain content to wire claims WITHOUT auto-injecting any envelope claims,
 * then spreads the profile/sensitive-identity/custom-claims envelope. The
 * expiry bundle is only computed when `content.expires` is present.
 */
export const encodeJwtPayload = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): Result => {
  const claims = mapContentToClaims<C>({ algorithm: config.algorithm }, content, options);

  const { payload, tokenId } = encodeClaimsPayload<C>(claims, content);

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

export const parseTokenPayload = <C extends Dict = Dict<never>>(
  decoded: DecodeClaims<C>,
): ParsedJwtPayload<C> => {
  if (!isFinite(decoded.exp)) {
    throw new JwtError("Missing claim: exp", {
      code: "jwt_missing_claim_exp",
      title: "JWT Missing Claim Exp",
      details: "The payload has no finite exp claim, which is required to parse a JWT.",
    });
  }
  if (!isFinite(decoded.iat)) {
    throw new JwtError("Missing claim: iat", {
      code: "jwt_missing_claim_iat",
      title: "JWT Missing Claim IAT",
      details: "The payload has no finite iat claim, which is required to parse a JWT.",
    });
  }
  if (!isString(decoded.iss)) {
    throw new JwtError("Missing claim: iss", {
      code: "jwt_missing_claim_iss",
      title: "JWT Missing Claim ISS",
      details: "The payload has no string iss claim, which is required to parse a JWT.",
    });
  }

  const { claims: domain, rest } = extractDomainClaims(decoded);
  const { profile, rest: afterProfile } = extractAegisProfile(rest);
  const { sensitiveIdentity, rest: customClaims } =
    extractSensitiveIdentity(afterProfile);

  // ParsedJwtPayload uses non-optional arrays with [] defaults and
  // "unknown" fallbacks for required fields — stricter than DomainClaims.
  return removeUndefined({
    ...domain,
    // Required fields (validated above — iss/exp/iat all checked)
    issuer: domain.issuer!,
    expiresAt: domain.expiresAt!,
    issuedAt: domain.issuedAt!,
    // Non-optional arrays default to []
    audience: domain.audience ?? [],
    authMethods: domain.authMethods ?? [],
    entitlements: domain.entitlements ?? [],
    groups: domain.groups ?? [],
    permissions: domain.permissions ?? [],
    roles: domain.roles ?? [],
    scope: domain.scope ?? [],
    // Non-optional strings default to "unknown"
    subject: domain.subject ?? "unknown",
    tokenId: domain.tokenId ?? "unknown",
    profile,
    sensitiveIdentity,
    claims: customClaims as C,
  });
};
