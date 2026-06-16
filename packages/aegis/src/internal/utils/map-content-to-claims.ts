import { expires } from "@lindorm/date";
import { isArray, isDate, isFinite, isObject, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { getUnixTime } from "@lindorm/date";
import { removeUndefined } from "@lindorm/utils";
import { JwtError } from "../../errors/index.js";
import type {
  ActClaim,
  ActClaimWire,
  JwtClaims,
  SignJwtContent,
  SignJwtOptions,
} from "../../types/index.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";

/**
 * Mint-time facts the domain content does not itself carry. The mapper needs
 * the signing `algorithm` to derive `at_hash`/`c_hash`/`s_hash`. Everything
 * else here is OPTIONAL because the mapper is policy-free: it injects no
 * envelope claims and requires nothing.
 */
export type MapContentContext = {
  algorithm: KryptosAlgorithm;
};

const actClaimToWire = (claim: ActClaim): ActClaimWire =>
  removeUndefined({
    sub: claim.subject,
    iss: claim.issuer,
    aud: claim.audience,
    client_id: claim.clientId,
    act: isObject(claim.act) ? actClaimToWire(claim.act) : undefined,
  });

/**
 * Pure domain → wire mapping. Maps the aegis domain vocabulary onto RFC wire
 * claim names. It is deliberately POLICY-FREE:
 *
 *   - it does NOT auto-inject `iat`/`jti`/`nbf`/`iss`,
 *   - it does NOT require `subject`/`expires`/`issuer`,
 *   - it does NOT throw for missing envelope claims.
 *
 * Mapping that is purely structural still happens here, including `exp`
 * derivation from `content.expires` (when present) and the OIDC hash claims
 * (which need the signing `algorithm`). Policy — requiredness, forbiddance,
 * and auto-injection — is applied by `buildProfileClaims`.
 */
export const mapContentToClaims = <C extends Dict = Dict>(
  ctx: MapContentContext,
  content: SignJwtContent<C>,
  options: SignJwtOptions = {},
): JwtClaims => {
  if (!isString(ctx.algorithm)) {
    throw new JwtError("Algorithm is required", {
      code: "jwt_algorithm_required",
      title: "JWT Algorithm Required",
      details: "No signing algorithm was supplied, so claim hashes cannot be computed.",
    });
  }

  const exp = content.expires ? expires(content.expires).expiresOn : undefined;

  const at_hash = isString(options.accessTokenHash)
    ? options.accessTokenHash
    : isString(content.accessToken)
      ? createAccessTokenHash(ctx.algorithm, content.accessToken)
      : undefined;

  const c_hash = isString(options.codeHash)
    ? options.codeHash
    : isString(content.authCode)
      ? createCodeHash(ctx.algorithm, content.authCode)
      : undefined;

  const s_hash = isString(options.stateHash)
    ? options.stateHash
    : isString(content.authState)
      ? createStateHash(ctx.algorithm, content.authState)
      : undefined;

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
    aal: isFinite(content.authenticatorAssuranceLevel)
      ? content.authenticatorAssuranceLevel
      : undefined,
    acr: isString(content.authContextClass) ? content.authContextClass : undefined,
    act: isObject(content.act) ? actClaimToWire(content.act) : undefined,
    afr: isArray(content.authFactor) ? content.authFactor : undefined,
    amr: isArray(content.authMethods) ? content.authMethods : undefined,
    at_hash,
    aud: isArray(content.audience) ? content.audience : undefined,
    authorization_details: isArray(content.authorizationDetails)
      ? content.authorizationDetails
      : undefined,
    auth_time: isDate(content.authTime) ? getUnixTime(content.authTime) : undefined,
    azp: isString(content.authorizedParty) ? content.authorizedParty : undefined,
    c_hash,
    client_id: isString(content.clientId) ? content.clientId : undefined,
    cnf: cnf && Object.keys(cnf).length > 0 ? cnf : undefined,
    entitlements: isArray(content.entitlements) ? content.entitlements : undefined,
    events: isObject(content.events) ? content.events : undefined,
    exp,
    fal: isFinite(content.federationAssuranceLevel)
      ? content.federationAssuranceLevel
      : undefined,
    groups: isArray(content.groups) ? content.groups : undefined,
    gty: isString(content.grantType) ? content.grantType : undefined,
    ial: isFinite(content.identityAssuranceLevel)
      ? content.identityAssuranceLevel
      : undefined,
    may_act: isObject(content.mayAct) ? actClaimToWire(content.mayAct) : undefined,
    iat: isDate(options.issuedAt) ? getUnixTime(options.issuedAt) : undefined,
    iss: isString(content.issuer) ? content.issuer : undefined,
    jti: isString(options.tokenId) ? options.tokenId : undefined,
    loa: isFinite(content.levelOfAssurance) ? content.levelOfAssurance : undefined,
    nbf: isDate(content.notBefore) ? getUnixTime(content.notBefore) : undefined,
    nonce: isString(content.nonce) ? content.nonce : undefined,
    permissions: isArray(content.permissions) ? content.permissions : undefined,
    roles: isArray(content.roles) ? content.roles : undefined,
    s_hash,
    scope: isArray(content.scope) ? content.scope : undefined,
    sid: isString(content.sessionId) ? content.sessionId : undefined,
    sih: isString(content.sessionHint) ? content.sessionHint : undefined,
    sub: isString(content.subject) ? content.subject : undefined,
    sub_id: isObject(content.subjectId) ? content.subjectId : undefined,
    suh: isString(content.subjectHint) ? content.subjectHint : undefined,
    tenant_id: isString(content.tenantId) ? content.tenantId : undefined,
    txn: isString(content.transactionId) ? content.transactionId : undefined,
    vot: isString(content.vectorOfTrust) ? content.vectorOfTrust : undefined,
    vtm: isString(content.vectorTrustMark) ? content.vectorTrustMark : undefined,
  });
};
