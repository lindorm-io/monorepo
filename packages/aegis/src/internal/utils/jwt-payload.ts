import { B64 } from "@lindorm/b64";
import { snakeKeys } from "@lindorm/case";
import { expires, getUnixTime } from "@lindorm/date";
import { isArray, isDate, isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { B64U } from "../constants/format.js";
import { JwtError } from "../../errors/index.js";
import type {
  ActClaim,
  ActClaimWire,
  JwtClaims,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
} from "../../types/index.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";
import { extractAegisProfile } from "./extract-aegis-profile.js";
import { extractDomainClaims } from "./extract-claims.js";
import { generateTokenId } from "./generate-token-id.js";

type Config = {
  algorithm: KryptosAlgorithm;
  issuer: string;
};

type DecodeClaims<C extends Dict = Dict> = JwtClaims & C;

type Result = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  payload: string;
  tokenId: string;
};

const actClaimToWire = (claim: ActClaim): ActClaimWire =>
  removeUndefined({
    sub: claim.subject,
    iss: claim.issuer,
    aud: claim.audience,
    client_id: claim.clientId,
    act: isObject(claim.act) ? actClaimToWire(claim.act) : undefined,
  });

export const mapJwtContentToClaims = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): JwtClaims => {
  if (!isString(config.algorithm)) {
    throw new JwtError("Algorithm is required");
  }
  if (!isUrlLike(config.issuer)) {
    throw new JwtError("Issuer is required");
  }
  if (!content.expires) {
    throw new JwtError("Expires is required");
  }
  if (!isString(content.subject)) {
    throw new JwtError("Subject is required");
  }

  const { expiresOn } = expires(content.expires);

  const at_hash = isString(options.accessTokenHash)
    ? options.accessTokenHash
    : isString(content.accessToken)
      ? createAccessTokenHash(config.algorithm, content.accessToken)
      : undefined;

  const c_hash = isString(options.codeHash)
    ? options.codeHash
    : isString(content.authCode)
      ? createCodeHash(config.algorithm, content.authCode)
      : undefined;

  const s_hash = isString(options.stateHash)
    ? options.stateHash
    : isString(content.authState)
      ? createStateHash(config.algorithm, content.authState)
      : undefined;

  const tokenId = isString(options.tokenId) ? options.tokenId : generateTokenId();

  const cnf = isObject(content.confirmation)
    ? removeUndefined({
        jkt: content.confirmation.thumbprint,
        "x5t#S256": content.confirmation.mtlsCertThumbprint,
        jwk: content.confirmation.key,
        kid: content.confirmation.keyId,
        jku: content.confirmation.jwkSetUri,
      })
    : undefined;

  return removeUndefined({
    aal: isFinite(content.adjustedAccessLevel) ? content.adjustedAccessLevel : undefined,
    acr: isString(content.authContextClass) ? content.authContextClass : undefined,
    act: isObject(content.act) ? actClaimToWire(content.act) : undefined,
    afr: isArray(content.authFactor) ? content.authFactor : undefined,
    amr: isArray(content.authMethods) ? content.authMethods : undefined,
    at_hash,
    aud: isArray(content.audience) ? content.audience : undefined,
    auth_time: isDate(content.authTime) ? getUnixTime(content.authTime) : undefined,
    azp: isString(content.authorizedParty) ? content.authorizedParty : undefined,
    c_hash,
    client_id: isString(content.clientId) ? content.clientId : undefined,
    cnf: cnf && Object.keys(cnf).length > 0 ? cnf : undefined,
    entitlements: isArray(content.entitlements) ? content.entitlements : undefined,
    exp: expiresOn,
    groups: isArray(content.groups) ? content.groups : undefined,
    gty: isString(content.grantType) ? content.grantType : undefined,
    may_act: isObject(content.mayAct) ? actClaimToWire(content.mayAct) : undefined,
    iat: isDate(options.issuedAt)
      ? getUnixTime(options.issuedAt)
      : getUnixTime(new Date()),
    iss: config.issuer,
    jti: tokenId,
    loa: isFinite(content.levelOfAssurance) ? content.levelOfAssurance : undefined,
    nbf: isDate(content.notBefore)
      ? getUnixTime(content.notBefore)
      : getUnixTime(new Date()),
    nonce: isString(content.nonce) ? content.nonce : undefined,
    permissions: isArray(content.permissions) ? content.permissions : undefined,
    roles: isArray(content.roles) ? content.roles : undefined,
    s_hash,
    scope: isArray(content.scope) ? content.scope : undefined,
    sid: isString(content.sessionId) ? content.sessionId : undefined,
    sih: isString(content.sessionHint) ? content.sessionHint : undefined,
    sub: content.subject,
    suh: isString(content.subjectHint) ? content.subjectHint : undefined,
    tenant_id: isString(content.tenantId) ? content.tenantId : undefined,
  });
};

export const encodeJwtPayload = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): Result => {
  const claims = mapJwtContentToClaims(config, content, options);
  const { expiresAt, expiresIn, expiresOn } = expires(content.expires);

  // AegisProfile fields are spread into the top-level JSON payload via
  // mechanical snake_case conversion. This keeps aegis-signed tokens
  // OIDC-compliant (profile claims like given_name, family_name, etc.
  // live at the top level of the token, not nested under a "profile" key).
  const profileWire = isObject(content.profile) ? snakeKeys(content.profile) : {};

  const payload = B64.encode(
    JSON.stringify({ ...claims, ...profileWire, ...(content.claims ?? {}) }),
    B64U,
  );

  return { expiresAt, expiresIn, expiresOn, payload, tokenId: claims.jti! };
};

export const decodeJwtPayload = <C extends Dict = Dict<never>>(
  payload: string,
): DecodeClaims<C> => JSON.parse(B64.toString(payload)) as DecodeClaims<C>;

export const parseTokenPayload = <C extends Dict = Dict<never>>(
  decoded: DecodeClaims<C>,
): ParsedJwtPayload<C> => {
  if (!isFinite(decoded.exp)) {
    throw new JwtError("Missing claim: exp");
  }
  if (!isFinite(decoded.iat)) {
    throw new JwtError("Missing claim: iat");
  }
  if (!isString(decoded.iss)) {
    throw new JwtError("Missing claim: iss");
  }

  const { claims: domain, rest } = extractDomainClaims(decoded);
  const { profile, rest: customClaims } = extractAegisProfile(rest);

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
    claims: customClaims as C,
  });
};
