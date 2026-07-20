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

// Permissive structural input — a consumer's OpenIdIntrospectResponse or a plain
// JSON body from the introspection endpoint passes through without a cast.
export type IntrospectClaimsInput = Dict & {
  active?: unknown;
};

// Drop the AegisProfile-category claims the translator surfaced — an
// introspection response is not a profile (RFC 7662 vs OIDC §5.3).
const omitProfileClaims = (claims: Dict): Dict => {
  const result: Dict = {};
  for (const key of Object.keys(claims)) {
    if (!PROFILE_CLAIM_KEYS.has(key)) result[key] = claims[key];
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

  const { claims } = Aegis.toDomain(data);

  return omitUndefined({
    ...omitProfileClaims(claims),
    active: true as const,
    tokenType: isString(data.tokenType)
      ? data.tokenType
      : isString((data as Dict).token_type)
        ? ((data as Dict).token_type as string)
        : undefined,
    username: isString(data.username) ? data.username : undefined,
  }) as PylonIntrospectionActive;
};
