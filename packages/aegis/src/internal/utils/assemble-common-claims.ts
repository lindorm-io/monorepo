import { expires, type Expiry } from "@lindorm/date";
import { isDate, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type {
  SignContent,
  SignContext,
  SignJwtOptions,
  TokenProfile,
} from "../../types/index.js";
import { CLAIMS_REGISTRY } from "../claims/claims-registry.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";
import { enforceProfilePolicy } from "./enforce-profile-policy.js";
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
  /**
   * Per-call lifetime override (`ProfileMintOptions.lifetime`). Beats the
   * profile's default `lifetime`; an explicit `content.expires` still wins over
   * both.
   */
  lifetime?: Expiry;
};

/**
 * Assembles the DOMAIN-keyed common claims layer — the single neutral
 * representation both the JOSE and (future) COSE encoders translate from, and
 * the layer that profile policy + RFC rules validate. Keys are domain names
 * (`issuer`, `subject`, `expiresAt`…), values are domain-shaped (`Date`s, the
 * domain `confirmation`/`act` objects, computed hash strings).
 *
 * It does NOT encode to any wire format — the JOSE encoder maps this to wire
 * claims via `domainToJose`, and the COSE encoder via `domainToCose` (the ONE
 * registry-driven translator). This is the structural guard against rebuilding a
 * JOSE-in-CBOR shim: business logic lives here, in domain terms, and translation
 * happens only at the encoder edges.
 */
export const assembleCommonClaims = (
  ctx: AssembleCommonContext,
  profile: TokenProfile,
  content: SignContent & { claims?: Dict },
  options: SignJwtOptions & { context?: SignContext } = {},
): Dict => {
  const now = ctx.now ?? new Date();

  // Envelope resolution in DOMAIN form (Date / string values), honouring the
  // profile's auto-injection, then translated to the wire by `domainToJose` /
  // `domainToCose`.
  const optIssuedAt = isDate(options.issuedAt) ? options.issuedAt : undefined;
  const issuedAt = profile.autoInject.includes("issuedAt")
    ? (optIssuedAt ?? now)
    : optIssuedAt;

  const contentNotBefore = isDate(content.notBefore) ? content.notBefore : undefined;
  const notBefore = profile.autoInject.includes("notBefore")
    ? (contentNotBefore ?? now)
    : contentNotBefore;

  const optTokenId = isString(options.tokenId) ? options.tokenId : undefined;
  const tokenId = profile.autoInject.includes("tokenId")
    ? (optTokenId ?? generateTokenId())
    : optTokenId;

  // Lifetime precedence: an explicit absolute `content.expires` wins, then the
  // per-call `ctx.lifetime` override, then the profile default (`null` ⇒ no exp).
  const lifetime = ctx.lifetime !== undefined ? ctx.lifetime : profile.lifetime;
  const expiresAt = content.expires
    ? expires(content.expires).expiresAt
    : lifetime != null
      ? expires(lifetime, now).expiresAt
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

  // Registry-driven pick of the standard-claim domain fields present on the
  // content (content uses domain names). Non-claim inputs (`expires`,
  // `accessToken`, `tokenType`…) are not registry domains, so they are excluded.
  // Only `category: "claims"` is picked from the top level: profile/sensitive
  // claims arrive in the `content.profile` / `content.sensitive` containers,
  // merged into the domain layer at the encoder edge — NOT as top-level fields —
  // and the OIDC `profile` URL claim
  // (registry domain `profile`) would otherwise collide with the `content.profile`
  // container object, leaking it onto the wire as a nested `profile` claim.
  const picked: Dict = {};
  for (const spec of CLAIMS_REGISTRY) {
    if (spec.category !== "claims") continue;
    const value = (content as Dict)[spec.domain];
    if (value !== undefined) picked[spec.domain] = value;
  }

  // Custom passthrough claims keep their LITERAL key so policy/validation can
  // see required custom claims (introspection's `token_introspection`, jarm's
  // `code`/`state`).
  const common = omitUndefined({
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
  if (!profile.autoInject.includes("issuer")) return contentIssuer;

  return ctx.issuer ?? contentIssuer;
};
