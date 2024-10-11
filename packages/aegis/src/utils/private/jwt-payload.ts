import { B64 } from "@lindorm/b64";
import { expires, getUnixTime } from "@lindorm/date";
import { isArray, isDate, isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { B64U } from "../../constants/private";
import { JwtError } from "../../errors";
import { JwtClaims, ParsedJwtPayload, SignJwtContent, SignJwtOptions } from "../../types";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash";

type Config = {
  algorithm: KryptosAlgorithm;
  issuer: string;
};

type Result = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  payload: string;
  tokenId: string;
};

export const encodeJwtPayload = <C extends Dict = Dict>(
  config: Config,
  content: SignJwtContent<C>,
  options: SignJwtOptions,
): Result => {
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
  if (!isString(content.tokenType)) {
    throw new JwtError("Token type is required");
  }

  const { expiresAt, expiresIn, expiresOn } = expires(content.expires);

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

  const claims: JwtClaims = removeUndefined({
    aal: isFinite(content.adjustedAccessLevel) ? content.adjustedAccessLevel : undefined,
    acr: isString(content.authContextClass) ? content.authContextClass : undefined,
    afr: isString(content.authFactor) ? content.authFactor : undefined,
    amr: isArray(content.authMethods) ? content.authMethods : undefined,
    at_hash,
    aud: isArray(content.audience) ? content.audience : undefined,
    auth_time: isDate(content.authTime) ? getUnixTime(content.authTime) : undefined,
    azp: isString(content.authorizedParty) ? content.authorizedParty : undefined,
    c_hash,
    cid: isString(content.clientId) ? content.clientId : undefined,
    exp: expiresOn,
    gty: isString(content.grantType) ? content.grantType : undefined,
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
    per: isArray(content.permissions) ? content.permissions : undefined,
    rls: isArray(content.roles) ? content.roles : undefined,
    s_hash,
    scp: isArray(content.scope) ? content.scope : undefined,
    sid: isString(content.sessionId) ? content.sessionId : undefined,
    sih: isString(content.sessionHint) ? content.sessionHint : undefined,
    sub: content.subject,
    suh: isString(content.subjectHint) ? content.subjectHint : undefined,
    tid: isString(content.tenantId) ? content.tenantId : undefined,
    token_type: content.tokenType,
  });

  const payload = B64.encode(
    JSON.stringify({
      ...claims,
      ...(content.claims ?? {}),
    }),
    B64U,
  );

  return { expiresAt, expiresIn, expiresOn, payload, tokenId };
};

type DecodeClaims<C extends Dict = Dict> = JwtClaims & C;

export const decodeJwtPayload = <C extends Dict = Dict<never>>(
  payload: string,
): DecodeClaims<C> => JSON.parse(B64.toString(payload)) as DecodeClaims<C>;

export const parseJwtPayload = <C extends Dict = Dict<never>>(
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
    afr,
    amr,
    at_hash,
    aud,
    auth_time,
    azp,
    c_hash,
    cid,
    exp,
    gty,
    iat,
    iss,
    jti,
    loa,
    nbf,
    nonce,
    per,
    rls,
    s_hash,
    scp,
    sid,
    sih,
    sub,
    suh,
    tid,
    token_type,
    ...rest
  } = decoded;

  const claims = (isObject(rest) ? rest : {}) as C;

  return removeUndefined({
    accessTokenHash: at_hash,
    adjustedAccessLevel: aal,
    audience: aud ?? [],
    authContextClass: acr,
    authFactor: afr,
    authMethods: amr ?? [],
    authorizedParty: azp,
    authTime: auth_time ? new Date(auth_time * 1000) : undefined,
    clientId: cid,
    codeHash: c_hash,
    expiresAt: exp ? new Date(exp * 1000) : undefined,
    grantType: gty,
    issuedAt: iat ? new Date(iat * 1000) : undefined,
    issuer: iss,
    levelOfAssurance: loa,
    nonce,
    notBefore: nbf ? new Date(nbf * 1000) : undefined,
    permissions: isArray(per) ? per : isString(per) ? [per] : [],
    roles: isArray(rls) ? rls : isString(rls) ? [rls] : [],
    scope: isArray(scp) ? scp : isString(scp) ? [scp] : [],
    sessionHint: sih,
    sessionId: sid,
    stateHash: s_hash,
    subject: sub ? sub : "unknown",
    subjectHint: suh,
    tenantId: tid,
    tokenId: jti ? jti : "unknown",
    tokenType: token_type ? token_type : "unknown",
    claims,
  });
};
