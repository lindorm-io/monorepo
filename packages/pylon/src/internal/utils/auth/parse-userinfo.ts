import { Aegis, type AegisProfile } from "@lindorm/aegis";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import type { PylonUserinfo } from "../../../types/index.js";
import { PROFILE_CLAIM_KEYS } from "./profile-claim-keys.js";

// Permissive structural input — a consumer's `Claims` response, a raw JSON
// body from the userinfo endpoint, or a parsed id_token payload all pass through
// without an explicit cast.
export type UserinfoClaimsInput = Dict;

// Keep ONLY the AegisProfile-category claims the translator surfaced. A flat
// userinfo response is the user's profile; non-profile claims are not part of it.
const pickProfileClaims = (claims: Dict): AegisProfile => {
  const profile: Dict = {};
  for (const key of Object.keys(claims)) {
    if (PROFILE_CLAIM_KEYS.has(key)) profile[key] = claims[key];
  }
  return profile as AegisProfile;
};

export const parseUserinfo = (data: UserinfoClaimsInput): PylonUserinfo => {
  const { claims } = Aegis.toDomain(data);

  if (!isString(claims.subject)) {
    throw new UserinfoEndpointFailed("Missing subject claim", {
      code: "userinfo_missing_subject",
      title: "Userinfo Missing Subject",
      details:
        "An OIDC userinfo response must include a string sub claim, which was missing or non-string.",
    });
  }

  // A parsed id_token payload carries an already-extracted `profile:
  // AegisProfile` object. When the caller hands us such a payload, prefer that
  // over re-collecting profile fields; otherwise treat the flat claims the
  // translator surfaced (the `profile` key there is the OIDC §5.1 profile URL).
  const preExtractedProfile: AegisProfile | undefined =
    isObject(data.profile) && !isString(data.profile)
      ? (data.profile as AegisProfile)
      : undefined;

  const profile = preExtractedProfile ?? pickProfileClaims(claims);

  return { ...profile, subject: claims.subject };
};
