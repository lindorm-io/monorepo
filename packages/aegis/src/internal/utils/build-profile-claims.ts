import { expires, getUnixTime } from "@lindorm/date";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { JwtError } from "../../errors/index.js";
import type {
  InvalidEntry,
  ProfileSignOptions,
  SignContent,
  SignContext,
  TokenProfile,
} from "../../types/index.js";
import { generateTokenId } from "./generate-token-id.js";
import { mapContentToClaims } from "./map-content-to-claims.js";

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

const enforcePolicy = (profile: TokenProfile, claims: Dict, ctx: SignContext): void => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of profile.required) {
    if (claims[key] === undefined) {
      invalid.push({ key, message: `Required claim "${key}" is missing` });
    }
  }

  for (const key of profile.forbidden) {
    if (claims[key] !== undefined) {
      invalid.push({ key, message: `Forbidden claim "${key}" is present` });
    }
  }

  for (const group of profile.atLeastOneOf) {
    if (!group.some((key) => claims[key] !== undefined)) {
      invalid.push({
        key: group.join("|"),
        message: `At least one of [${group.join(", ")}] is required`,
      });
    }
  }

  for (const { claim, when } of profile.requiredWhen) {
    if (claims[claim] === undefined && when(claims, ctx)) {
      invalid.push({
        key: claim,
        message: `Conditionally required claim "${claim}" is missing`,
      });
    }
  }

  if (invalid.length > 0) {
    throw new JwtError("Invalid token", {
      code: "jwt_claims_invalid",
      data: { invalid },
      debug: { invalid, profile: profile.name },
      title: "JWT Claims Invalid",
      details:
        "The assembled claims do not satisfy the profile's required/forbidden/conditional rules.",
    });
  }
};

/**
 * Applies a profile's policy on top of the policy-free domain mapping:
 *
 *   1. map domain → wire (`mapContentToClaims`),
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
  options: ProfileSignOptions = {},
): Dict => {
  const now = ctx.now ?? new Date();
  const nowUnix = getUnixTime(now);

  const mapped = mapContentToClaims(
    { algorithm: ctx.algorithm },
    content as any,
    options,
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
  const claims = removeUndefined({
    ...mapped,
    ...(content.claims ?? {}),
    iat,
    nbf,
    jti,
    exp,
    iss,
  }) as Dict;

  enforcePolicy(profile, claims, options.context ?? {});

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

export { enforcePolicy as enforceProfilePolicy };
