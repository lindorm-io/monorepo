import { isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { AegisError } from "../../errors";
import { AegisProfile, AegisUserinfo } from "../../types";
import { extractAegisProfile } from "./extract-aegis-profile";
import { extractDomainClaims } from "./extract-claims";

// Locally-defined input shape — permissive structural type so a consumer's
// `OpenIdClaims` response (or any other claim dict) passes through without
// an explicit cast. Aegis owns the claim-parsing surface.
export type UserinfoClaimsInput = Dict;

export const parseUserinfo = (data: UserinfoClaimsInput): AegisUserinfo => {
  const { claims, rest } = extractDomainClaims(data);

  // ParsedJwtPayload carries an already-extracted `profile: AegisProfile`
  // object. When the caller hands us such a payload, prefer that over
  // re-extracting profile fields from the rest dict. Otherwise treat the
  // `profile` key as the OIDC §5.1 profile URL claim.
  const preExtractedProfile: AegisProfile | undefined =
    isObject(rest.profile) && !isString(rest.profile)
      ? (rest.profile as AegisProfile)
      : undefined;

  if (preExtractedProfile) delete rest.profile;

  const { profile: extractedProfile } = extractAegisProfile(rest);
  const profile = preExtractedProfile ?? extractedProfile;

  if (!isString(claims.subject)) {
    throw new AegisError("Missing subject claim");
  }

  return {
    ...(profile ?? {}),
    subject: claims.subject,
  };
};
