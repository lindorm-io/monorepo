import { Aegis } from "@lindorm/aegis";
import { isBoolean, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import type {
  PylonIntrospection,
  PylonIntrospectionActive,
} from "../../../types/index.js";
import { PROFILE_CLAIM_KEYS } from "./profile-claim-keys.js";
import { SENSITIVE_CLAIM_KEYS } from "./sensitive-claim-keys.js";

// Permissive structural input — a consumer's `IntrospectResponse` or a plain
// JSON body from the introspection endpoint passes through without a cast.
export type IntrospectClaimsInput = Dict & {
  active?: unknown;
};

// Drop the IDENTITY claims the translator surfaced: the AegisProfile category
// (an introspection response is not a profile — RFC 7662 vs OIDC §5.3) and the
// AegisSensitive category (which `DomainClaims` does not declare, and which the
// locally-verified path suppresses on an unencrypted token per OIDC Core §13.3).
// Both are identity, and `ctx.state.access.claims` answers an authorization
// question; keeping either would make the introspected arm resolve a wider claim
// set than the verified one.
const omitIdentityClaims = (claims: Dict): Dict => {
  const result: Dict = {};
  for (const key of Object.keys(claims)) {
    if (PROFILE_CLAIM_KEYS.has(key) || SENSITIVE_CLAIM_KEYS.has(key)) continue;
    result[key] = claims[key];
  }
  return result;
};

// RFC 7662 §2.2 response members that describe the ANSWER, not the token: they
// have no registry entry, so the translator sweeps them into the custom bucket
// alongside the real extension claims. They already have their own places on
// `PylonIntrospectionActive`, so the bucket must not repeat them. (`token_type`
// arrives here as `tokenType` — the translator camelCases every unregistered
// key before this runs.)
//
// ⚠ `username` is NOT one of them. It is a claim ABOUT the token — an
// authorization server that can report one means a token can carry one — so it
// is a REGISTERED aegis claim and the translator resolves it into `claims` on
// its own. Filtering it here would strip it from the introspected path only,
// re-opening the very verified-vs-introspected divergence this parser closes.
const RESPONSE_MEMBER_KEYS: ReadonlySet<string> = new Set(["active", "tokenType"]);

// The extension claims, kept whole. `custom` itself is NOT special-cased: a
// server that returns a member named `custom` gets it at `custom.custom`, which
// is exactly where an unregistered key belongs.
const pickCustomClaims = (custom: Dict): Dict => {
  const result: Dict = {};
  for (const key of Object.keys(custom)) {
    if (!RESPONSE_MEMBER_KEYS.has(key)) result[key] = custom[key];
  }
  return result;
};

export const parseIntrospection = (data: IntrospectClaimsInput): PylonIntrospection => {
  if (!isBoolean(data.active)) {
    throw new IntrospectionEndpointFailed("Missing active claim", {
      code: "introspection_missing_active",
      title: "Introspection Missing Active",
      details:
        "An OAuth 2.0 introspection response must include a boolean active field, which was missing or non-boolean.",
    });
  }

  if (!data.active) {
    return { active: false };
  }

  const { claims, custom } = Aegis.toDomain(data);

  return omitUndefined({
    ...omitIdentityClaims(claims),
    active: true as const,
    custom: pickCustomClaims(custom),
    tokenType: isString(data.tokenType)
      ? data.tokenType
      : isString((data as Dict).token_type)
        ? ((data as Dict).token_type as string)
        : undefined,
  }) as PylonIntrospectionActive;
};
