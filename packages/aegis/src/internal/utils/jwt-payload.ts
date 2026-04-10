import { B64 } from "@lindorm/b64";
import { camelKeys, snakeKeys } from "@lindorm/case";
import { expires, getUnixTime } from "@lindorm/date";
import { isArray, isDate, isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { B64U } from "../constants/format";
import { JwtError } from "../../errors";
import {
  AegisProfile,
  JwtClaims,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
} from "../../types";
import { AEGIS_PROFILE_WIRE_KEYS } from "../constants/aegis-profile-keys";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash";

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

  const tokenId = isString(options.tokenId) ? options.tokenId : randomUUID();

  return removeUndefined({
    aal: isFinite(content.adjustedAccessLevel) ? content.adjustedAccessLevel : undefined,
    acr: isString(content.authContextClass) ? content.authContextClass : undefined,
    act: isObject(content.act) ? content.act : undefined,
    afr: isArray(content.authFactor) ? content.authFactor : undefined,
    amr: isArray(content.authMethods) ? content.authMethods : undefined,
    at_hash,
    aud: isArray(content.audience) ? content.audience : undefined,
    auth_time: isDate(content.authTime) ? getUnixTime(content.authTime) : undefined,
    azp: isString(content.authorizedParty) ? content.authorizedParty : undefined,
    c_hash,
    client_id: isString(content.clientId) ? content.clientId : undefined,
    entitlements: isArray(content.entitlements) ? content.entitlements : undefined,
    exp: expiresOn,
    groups: isArray(content.groups) ? content.groups : undefined,
    gty: isString(content.grantType) ? content.grantType : undefined,
    may_act: isObject(content.mayAct) ? content.mayAct : undefined,
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

  const {
    aal,
    acr,
    act,
    afr,
    amr,
    at_hash,
    aud,
    auth_time,
    azp,
    c_hash,
    client_id,
    entitlements,
    exp,
    groups,
    gty,
    iat,
    iss,
    jti,
    loa,
    may_act,
    nbf,
    nonce,
    permissions,
    roles,
    s_hash,
    scope,
    sid,
    sih,
    sub,
    suh,
    tenant_id,
    ...rest
  } = decoded;

  // Partition remaining claims into AegisProfile fields (which we'll
  // camelCase and surface as payload.profile) and truly custom claims
  // (passed through unchanged to payload.claims).
  const profileWire: Dict = {};
  const customClaims: Dict = {};

  for (const [key, value] of Object.entries(rest)) {
    if (AEGIS_PROFILE_WIRE_KEYS.has(key)) {
      profileWire[key] = value;
    } else {
      customClaims[key] = value;
    }
  }

  const profile =
    Object.keys(profileWire).length > 0
      ? (camelKeys(profileWire) as AegisProfile)
      : undefined;

  const claims = customClaims as C;

  return removeUndefined({
    accessTokenHash: at_hash,
    act,
    adjustedAccessLevel: aal,
    audience: aud ?? [],
    authContextClass: acr,
    authFactor: afr,
    authMethods: amr ?? [],
    authorizedParty: azp,
    authTime: auth_time ? new Date(auth_time * 1000) : undefined,
    clientId: client_id,
    codeHash: c_hash,
    entitlements: isArray(entitlements) ? entitlements : [],
    expiresAt: exp ? new Date(exp * 1000) : undefined,
    grantType: gty,
    groups: isArray(groups) ? groups : [],
    issuedAt: iat ? new Date(iat * 1000) : undefined,
    issuer: iss,
    levelOfAssurance: loa,
    mayAct: may_act,
    nonce,
    notBefore: nbf ? new Date(nbf * 1000) : undefined,
    permissions: isArray(permissions)
      ? permissions
      : isString(permissions)
        ? [permissions]
        : [],
    profile,
    roles: isArray(roles) ? roles : isString(roles) ? [roles] : [],
    scope: isArray(scope) ? scope : isString(scope) ? [scope] : [],
    sessionHint: sih,
    sessionId: sid,
    stateHash: s_hash,
    subject: sub ? sub : "unknown",
    subjectHint: suh,
    tenantId: tenant_id,
    tokenId: jti ? jti : "unknown",
    claims,
  });
};
