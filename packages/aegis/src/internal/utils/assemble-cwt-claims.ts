import { expires } from "@lindorm/date";
import { isArray, isDate, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type { SignCwtContent, SignCwtOptions } from "../../types/index.js";
import { CLAIMS_REGISTRY } from "../claims/claims-registry.js";

/**
 * Mint-time facts the content does not carry: the platform `issuer` (the `iss`
 * source) and the now-instant (`now`, defaults to current time) so `expiresAt`
 * stays coherent within a single sign.
 */
export type AssembleCwtContext = {
  issuer: string | null;
  now?: Date;
};

// Envelope claims are resolved explicitly below; the registry loop picks every
// OTHER domain claim present on the content (subject, scope, roles, …).
const ENVELOPE_DOMAINS: ReadonlySet<string> = new Set([
  "issuer",
  "audience",
  "expiresAt",
  "notBefore",
  "issuedAt",
  "tokenId",
]);

/**
 * Policy-free standard-claim assembly for the generic CWT — the COSE analogue of
 * `assembleJwtWireClaims`. Maps the standard-claim content to the DOMAIN-keyed dict
 * `coseKit.sign` encodes (which the claim registry turns into CWT labels). It
 * injects NO envelope claims (no `iat`/`jti`/`nbf` auto-injection) and enforces
 * no profile policy; the deployment `issuer` is used only to default `iss` when
 * the content does not carry one (RFC 8392 makes every claim optional).
 */
export const assembleCwtClaims = (
  ctx: AssembleCwtContext,
  content: SignCwtContent,
  options: SignCwtOptions = {},
): Dict => {
  const now = ctx.now ?? new Date();

  const expiresAt = content.expires ? expires(content.expires, now).expiresAt : undefined;

  const audience = isString(content.audience)
    ? [content.audience]
    : isArray<string>(content.audience)
      ? content.audience
      : undefined;

  const issuer = isString(content.issuer) ? content.issuer : (ctx.issuer ?? undefined);

  // Registry-driven pick of the non-envelope domain claims present on the
  // content (scope, roles, clientId, …). Non-claim inputs (`expires`, `profile`,
  // `sensitiveIdentity`, `tokenType`…) are not registry domains, so they are
  // excluded, exactly as assembleCommonClaims does for the profiled path.
  const picked: Dict = {};
  for (const spec of CLAIMS_REGISTRY) {
    if (ENVELOPE_DOMAINS.has(spec.domain)) continue;
    const value = (content as Dict)[spec.domain];
    if (value !== undefined) picked[spec.domain] = value;
  }

  return omitUndefined({
    ...picked,
    issuer,
    audience,
    expiresAt,
    notBefore: isDate(content.notBefore) ? content.notBefore : undefined,
    issuedAt: isDate(options.issuedAt) ? options.issuedAt : undefined,
    tokenId: isString(options.tokenId) ? options.tokenId : undefined,
    ...(content.claims ?? {}),
  }) as Dict;
};
