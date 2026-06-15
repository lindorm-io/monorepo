import { expires } from "@lindorm/date";
import { isDate, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { CLAIM_REGISTRY } from "../claims/registry.js";
import type { ProfileSignOptions, SignContent, TokenProfile } from "../../types/index.js";
import { enforceProfilePolicy } from "./build-profile-claims.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";
import { generateTokenId } from "./generate-token-id.js";

/**
 * Mint-time facts the content does not carry: the signing `algorithm` (for the
 * OIDC hash claims), the platform `issuer` (the `iss` source), and the
 * now-instant (`now`, defaults to current time) so `issuedAt`/`notBefore`/
 * `expiresAt` stay coherent within a single mint.
 */
export type AssembleCommonContext = {
  algorithm: KryptosAlgorithm;
  issuer: string | null;
  now?: Date;
};

/**
 * Assembles the DOMAIN-keyed common claims layer — the single neutral
 * representation both the JOSE and (future) COSE encoders translate from, and
 * the layer that profile policy + RFC rules validate. Keys are domain names
 * (`issuer`, `subject`, `expiresAt`…), values are domain-shaped (`Date`s, the
 * domain `confirmation`/`act` objects, computed hash strings).
 *
 * It does NOT encode to any wire format — the JOSE encoder maps this to wire
 * claims via the existing `mapContentToClaims` (fed the resolved envelope), and
 * the COSE encoder will map it via the claim registry. This is the structural
 * guard against rebuilding a JOSE-in-CBOR shim: business logic lives here, in
 * domain terms, and translation happens only at the encoder edges.
 */
export const assembleCommonClaims = (
  ctx: AssembleCommonContext,
  profile: TokenProfile,
  content: SignContent & { claims?: Dict },
  options: ProfileSignOptions = {},
): Dict => {
  const now = ctx.now ?? new Date();

  // Envelope resolution in DOMAIN form (Date / string values), honouring the
  // profile's auto-injection. Mirrors the wire envelope logic in
  // build-profile-claims, but stays domain-shaped.
  const optIssuedAt = isDate(options.issuedAt) ? options.issuedAt : undefined;
  const issuedAt = profile.autoInject.iat ? (optIssuedAt ?? now) : optIssuedAt;

  const contentNotBefore = isDate(content.notBefore) ? content.notBefore : undefined;
  const notBefore = profile.autoInject.nbf ? (contentNotBefore ?? now) : contentNotBefore;

  const optTokenId = isString(options.tokenId) ? options.tokenId : undefined;
  const tokenId = profile.autoInject.jti ? (optTokenId ?? generateTokenId()) : optTokenId;

  const expiresAt = content.expires
    ? expires(content.expires).expiresAt
    : profile.lifetime != null
      ? expires(profile.lifetime, now).expiresAt
      : undefined;

  const issuer = resolveIssuer(ctx, profile, content);

  // OIDC hash claims — same computation the wire mapper does (needs the alg);
  // domain names, string values (b64url; the COSE encoder turns them to bstr).
  const accessTokenHash = isString(options.accessTokenHash)
    ? options.accessTokenHash
    : isString(content.accessToken)
      ? createAccessTokenHash(ctx.algorithm, content.accessToken)
      : undefined;
  const codeHash = isString(options.codeHash)
    ? options.codeHash
    : isString(content.authCode)
      ? createCodeHash(ctx.algorithm, content.authCode)
      : undefined;
  const stateHash = isString(options.stateHash)
    ? options.stateHash
    : isString(content.authState)
      ? createStateHash(ctx.algorithm, content.authState)
      : undefined;

  // Registry-driven pick of the domain claim fields present on the content
  // (content uses domain names). Non-claim inputs (`expires`, `accessToken`,
  // `profile`, `sensitiveIdentity`, `tokenType`…) are not registry domains, so
  // they are excluded.
  const picked: Dict = {};
  for (const spec of CLAIM_REGISTRY) {
    const value = (content as Dict)[spec.domain];
    if (value !== undefined) picked[spec.domain] = value;
  }

  // Custom passthrough claims keep their LITERAL key so policy/validation can
  // see required custom claims (introspection's `token_introspection`, jarm's
  // `code`/`state`).
  const common = removeUndefined({
    ...picked,
    issuedAt,
    notBefore,
    tokenId,
    expiresAt,
    issuer,
    accessTokenHash,
    codeHash,
    stateHash,
    ...(content.claims ?? {}),
  }) as Dict;

  // Presence/forbid/atLeastOneOf/requiredWhen policy runs on the DOMAIN layer
  // (profile arrays are domain-named). The structural RFC rules run separately
  // via validateProfileClaims.
  enforceProfilePolicy(profile, common, options.context ?? {});

  return common;
};

const resolveIssuer = (
  ctx: AssembleCommonContext,
  profile: TokenProfile,
  content: SignContent,
): string | undefined => {
  const contentIssuer = isString(content.issuer) ? content.issuer : undefined;

  if (profile.issuer === "per-token") return contentIssuer;
  if (!profile.autoInject.iss) return contentIssuer;

  return ctx.issuer ?? contentIssuer;
};
