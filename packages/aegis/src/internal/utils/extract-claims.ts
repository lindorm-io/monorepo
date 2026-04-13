import { isArray, isFinite, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { ActClaim } from "../../types/claims/act-claim";
import { ConfirmationClaim } from "../../types/claims/confirmation-claim";
import { LindormClaims } from "../../types/claims/lindorm-claims";
import { OAuthClaims } from "../../types/claims/oauth-claims";
import { OidcClaims } from "../../types/claims/oidc-claims";
import { PopClaims } from "../../types/claims/pop-claims";
import { DelegationClaims } from "../../types/claims/delegation-claims";
import { StdClaims } from "../../types/claims/std-claims";
import { AdjustedAccessLevel, LevelOfAssurance } from "../../types/level-of-assurance";

// Unified domain claim set — RFC-grouped intersection that JWT parsing,
// introspection parsing, and userinfo parsing all share.
export type DomainClaims = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  LindormClaims;

export type ExtractClaimsResult = {
  claims: DomainClaims;
  rest: Dict;
};

// Map of every domain field name to the set of input keys we recognise for
// it. The first matching key in the input is used. Both camelCase (already
// parsed / conduit-transformed) and snake/wire forms are listed where they
// differ.
//
// Recursive claims (act, mayAct, confirmation) are handled separately
// because their inner shapes also need name-translation.
const FIELD_KEYS: Record<string, ReadonlyArray<string>> = {
  // StdClaims
  subject: ["subject", "sub"],
  expiresAt: ["expiresAt", "exp"],
  issuedAt: ["issuedAt", "iat"],
  notBefore: ["notBefore", "nbf"],
  issuer: ["issuer", "iss"],
  audience: ["audience", "aud"],
  tokenId: ["tokenId", "jti"],

  // OidcClaims
  accessTokenHash: ["accessTokenHash", "at_hash"],
  authContextClass: ["authContextClass", "acr"],
  authMethods: ["authMethods", "amr"],
  authorizedParty: ["authorizedParty", "azp"],
  authTime: ["authTime", "auth_time"],
  codeHash: ["codeHash", "c_hash"],
  nonce: ["nonce"],
  stateHash: ["stateHash", "s_hash"],

  // OAuthClaims (RFC 9068)
  entitlements: ["entitlements"],
  groups: ["groups"],
  roles: ["roles"],

  // LindormClaims
  adjustedAccessLevel: ["adjustedAccessLevel", "aal"],
  authFactor: ["authFactor", "afr"],
  clientId: ["clientId", "client_id"],
  grantType: ["grantType", "gty"],
  levelOfAssurance: ["levelOfAssurance", "loa"],
  permissions: ["permissions"],
  scope: ["scope"],
  sessionHint: ["sessionHint", "sih"],
  sessionId: ["sessionId", "sid"],
  subjectHint: ["subjectHint", "suh"],
  tenantId: ["tenantId", "tenant_id"],
};

// Recursive claim extractors get their own key sets so we can also strip
// them from the leftover `rest`.
const RFC8693_KEYS = {
  act: ["act"],
  mayAct: ["mayAct", "may_act"],
} as const;

const POP_KEYS = {
  confirmation: ["confirmation", "cnf"],
} as const;

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (isFinite(value)) return new Date(value * 1000);
  return undefined;
};

const toStringArray = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return value.split(" ").filter(Boolean);
  return undefined;
};

const toAudience = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return [value];
  return undefined;
};

// Recursively normalise an act-claim, accepting both camelCase and snake
// forms at every level.
const toActClaim = (value: unknown): ActClaim | undefined => {
  if (!isObject(value)) return undefined;
  const v = value;
  const result: ActClaim = removeUndefined({
    subject: isString(v.subject) ? v.subject : isString(v.sub) ? v.sub : undefined,
    issuer: isString(v.issuer) ? v.issuer : isString(v.iss) ? v.iss : undefined,
    audience: toAudience(v.audience ?? v.aud),
    clientId: isString(v.clientId)
      ? v.clientId
      : isString(v.client_id)
        ? v.client_id
        : undefined,
    act: toActClaim(v.act),
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

// RFC 7800 confirmation claim. Inner keys are wire-form (`jkt`, `jwk`,
// `kid`, `x5t#S256`, `jku`) — but consumers may also pass the camelCase
// domain form already.
const toConfirmation = (value: unknown): ConfirmationClaim | undefined => {
  if (!isObject(value)) return undefined;
  const v = value;
  const result: ConfirmationClaim = removeUndefined({
    thumbprint: isString(v.thumbprint)
      ? v.thumbprint
      : isString(v.jkt)
        ? v.jkt
        : undefined,
    mtlsCertThumbprint: isString(v.mtlsCertThumbprint)
      ? v.mtlsCertThumbprint
      : isString(v["x5t#S256"])
        ? v["x5t#S256"]
        : undefined,
    key: isObject(v.key)
      ? (v.key as ConfirmationClaim["key"])
      : isObject(v.jwk)
        ? (v.jwk as ConfirmationClaim["key"])
        : undefined,
    keyId: isString(v.keyId) ? v.keyId : isString(v.kid) ? v.kid : undefined,
    jwkSetUri: isString(v.jwkSetUri) ? v.jwkSetUri : isString(v.jku) ? v.jku : undefined,
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Extract domain claims (StdClaims & OidcClaims & PopClaims & DelegationClaims
 * & OAuthClaims & LindormClaims) from an input dictionary that may use
 * either camelCase domain names or snake/wire names for each field.
 *
 * Returns the parsed domain claims plus the leftover input keys that the
 * parser did not consume. Consumers that need to further partition
 * (e.g. extract AegisProfile fields) operate on the leftover dict.
 *
 * Used by parseTokenPayload, parseIntrospection, and parseUserinfo to
 * avoid duplicating the field-by-field mapping.
 */
export const extractDomainClaims = (input: Dict): ExtractClaimsResult => {
  const consumed = new Set<string>();

  const consume = (keys: ReadonlyArray<string>): unknown => {
    for (const key of keys) {
      if (key in input) {
        consumed.add(key);
        return input[key];
      }
    }
    return undefined;
  };

  // Walk each domain field, marking source keys as consumed.
  const subject = consume(FIELD_KEYS.subject);
  const expiresAt = consume(FIELD_KEYS.expiresAt);
  const issuedAt = consume(FIELD_KEYS.issuedAt);
  const notBefore = consume(FIELD_KEYS.notBefore);
  const issuer = consume(FIELD_KEYS.issuer);
  const audience = consume(FIELD_KEYS.audience);
  const tokenId = consume(FIELD_KEYS.tokenId);

  const accessTokenHash = consume(FIELD_KEYS.accessTokenHash);
  const authContextClass = consume(FIELD_KEYS.authContextClass);
  const authMethods = consume(FIELD_KEYS.authMethods);
  const authorizedParty = consume(FIELD_KEYS.authorizedParty);
  const authTime = consume(FIELD_KEYS.authTime);
  const codeHash = consume(FIELD_KEYS.codeHash);
  const nonce = consume(FIELD_KEYS.nonce);
  const stateHash = consume(FIELD_KEYS.stateHash);

  const entitlements = consume(FIELD_KEYS.entitlements);
  const groups = consume(FIELD_KEYS.groups);
  const roles = consume(FIELD_KEYS.roles);

  const adjustedAccessLevel = consume(FIELD_KEYS.adjustedAccessLevel);
  const authFactor = consume(FIELD_KEYS.authFactor);
  const clientId = consume(FIELD_KEYS.clientId);
  const grantType = consume(FIELD_KEYS.grantType);
  const levelOfAssurance = consume(FIELD_KEYS.levelOfAssurance);
  const permissions = consume(FIELD_KEYS.permissions);
  const scope = consume(FIELD_KEYS.scope);
  const sessionHint = consume(FIELD_KEYS.sessionHint);
  const sessionId = consume(FIELD_KEYS.sessionId);
  const subjectHint = consume(FIELD_KEYS.subjectHint);
  const tenantId = consume(FIELD_KEYS.tenantId);

  const act = consume(RFC8693_KEYS.act);
  const mayAct = consume(RFC8693_KEYS.mayAct);
  const confirmation = consume(POP_KEYS.confirmation);

  const claims: DomainClaims = removeUndefined({
    // StdClaims
    subject: isString(subject) ? subject : undefined,
    expiresAt: toDate(expiresAt),
    issuedAt: toDate(issuedAt),
    notBefore: toDate(notBefore),
    issuer: isString(issuer) ? issuer : undefined,
    audience: toAudience(audience),
    tokenId: isString(tokenId) ? tokenId : undefined,

    // OidcClaims
    accessTokenHash: isString(accessTokenHash) ? accessTokenHash : undefined,
    authContextClass: isString(authContextClass) ? authContextClass : undefined,
    authMethods: isArray(authMethods) ? (authMethods as Array<string>) : undefined,
    authorizedParty: isString(authorizedParty) ? authorizedParty : undefined,
    authTime: toDate(authTime),
    codeHash: isString(codeHash) ? codeHash : undefined,
    nonce: isString(nonce) ? nonce : undefined,
    stateHash: isString(stateHash) ? stateHash : undefined,

    // PopClaims
    confirmation: toConfirmation(confirmation),

    // DelegationClaims
    act: toActClaim(act),
    mayAct: toActClaim(mayAct),

    // OAuthClaims
    entitlements: isArray(entitlements) ? (entitlements as Array<string>) : undefined,
    groups: isArray(groups) ? (groups as Array<string>) : undefined,
    roles: toStringArray(roles),

    // LindormClaims
    adjustedAccessLevel: isFinite<AdjustedAccessLevel>(adjustedAccessLevel)
      ? adjustedAccessLevel
      : undefined,
    authFactor: isArray(authFactor) ? (authFactor as Array<string>) : undefined,
    clientId: isString(clientId) ? clientId : undefined,
    grantType: isString(grantType) ? grantType : undefined,
    levelOfAssurance: isFinite<LevelOfAssurance>(levelOfAssurance)
      ? levelOfAssurance
      : undefined,
    permissions: toStringArray(permissions),
    scope: toStringArray(scope),
    sessionHint: isString(sessionHint) ? sessionHint : undefined,
    sessionId: isString(sessionId) ? sessionId : undefined,
    subjectHint: isString(subjectHint) ? subjectHint : undefined,
    tenantId: isString(tenantId) ? tenantId : undefined,
  });

  // Build the leftover dict — every key the parser didn't consume.
  const rest: Dict = {};
  for (const key of Object.keys(input)) {
    if (!consumed.has(key)) rest[key] = input[key];
  }

  return { claims, rest };
};

// Re-exported for callers that want to know the canonical set of input
// names per field (e.g. for tests or static analysis).
export const DOMAIN_CLAIM_KEYS: Readonly<Record<string, ReadonlyArray<string>>> = {
  ...FIELD_KEYS,
  ...RFC8693_KEYS,
  ...POP_KEYS,
};
