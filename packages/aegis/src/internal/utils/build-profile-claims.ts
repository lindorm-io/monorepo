import { expires, getUnixTime } from "@lindorm/date";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type { SignContent, SignJwtOptions, TokenProfile } from "../../types/index.js";
import { domainToJose } from "../claims/translate.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { generateTokenId } from "./generate-token-id.js";

/**
 * Mint-time facts the profile engine needs that the content does not carry:
 * the signing `algorithm` (for hash claims), the platform `issuer` (for the
 * `iss` source), and the now-instant (`now`, defaults to current time) so
 * `iat`/`nbf`/`exp` stay coherent within a single mint.
 */
export type BuildProfileContext = {
  algorithm: KryptosAlgorithm;
  issuer: string | null;
  now?: Date;
};

// The policy-FREE profile the wire mapping runs under: no auto-injection, no
// required/forbidden, per-token issuer, no lifetime. `assembleCommonClaims` under
// it does ONLY the domain envelope resolution + hash derivation, so `domainToJose`
// of the result is the pure content -> wire map this builder then injects onto.
const RAW_PROFILE: TokenProfile = {
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

/**
 * Applies a profile's policy on top of the policy-free domain mapping:
 *
 *   1. map domain → wire (`domainToJose` of the policy-free common claims),
 *   2. auto-inject `iat`/`jti`/`nbf`/`iss` per `profile.autoInject`,
 *   3. derive `exp` from `profile.lifetime` (when the content did not set
 *      `expires`; `lifetime: null` means "no exp"),
 *   4. apply the issuer source (`platform` vs `per-token`),
 *   5. enforce required/forbidden/atLeastOneOf/requiredWhen + `validate`.
 *
 * Returns the assembled wire claims dict ready to be signed.
 */
export const buildProfileClaims = <C extends Dict = Dict>(
  ctx: BuildProfileContext,
  profile: TokenProfile,
  content: SignContent & { claims?: C },
  options: SignJwtOptions = {},
): Dict => {
  const now = ctx.now ?? new Date();
  const nowUnix = getUnixTime(now);

  // Content -> wire via the ONE translator (policy-free): the domain envelope +
  // hash derivation from `assembleCommonClaims`, mapped by `domainToJose`.
  const mapped = domainToJose(
    assembleCommonClaims(
      { algorithm: ctx.algorithm, issuer: null },
      RAW_PROFILE,
      content,
      options,
    ),
  );

  const iat = profile.autoInject.iat ? (mapped.iat ?? nowUnix) : mapped.iat;
  const nbf = profile.autoInject.nbf ? (mapped.nbf ?? nowUnix) : mapped.nbf;
  const jti = profile.autoInject.jti ? (mapped.jti ?? generateTokenId()) : mapped.jti;

  const exp =
    mapped.exp ??
    (profile.lifetime != null ? expires(profile.lifetime, now).expiresOn : undefined);

  const iss = resolveIssuer(ctx, profile, mapped);

  // Custom claims (the `C` dict) are folded in here so the profile's
  // required/forbidden/validate rules can see them (e.g. introspection's
  // `token_introspection`, jarm's `code`/`state`). They are also re-spread at
  // encode time; the merge is idempotent.
  const claims = omitUndefined({
    ...mapped,
    ...(content.claims ?? {}),
    iat,
    nbf,
    jti,
    exp,
    iss,
  }) as Dict;

  // Policy (required/forbidden/atLeastOneOf/requiredWhen) is now enforced on the
  // DOMAIN-keyed common layer by `assembleCommonClaims`, not here. This function
  // is purely the JOSE wire mapper + envelope injection; `mintProfile` feeds it
  // the envelope already resolved by `assembleCommonClaims` so the two agree.
  return claims;
};

const resolveIssuer = (
  ctx: BuildProfileContext,
  profile: TokenProfile,
  mapped: Dict,
): string | undefined => {
  // `per-token` issuers are carried on the wire-mapped claims (set by a
  // caller-supplied issuer in a later chunk); the platform issuer comes from
  // the kit config and is injected only when the profile opts in.
  if (profile.issuer === "per-token") {
    return mapped.iss as string | undefined;
  }

  if (!profile.autoInject.iss) {
    return mapped.iss as string | undefined;
  }

  return ctx.issuer ?? (mapped.iss as string | undefined);
};
