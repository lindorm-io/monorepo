import { Aegis } from "@lindorm/aegis";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import type { PylonUserinfo } from "../../../types/index.js";

// Permissive structural input — a consumer's `Claims` response or a raw JSON
// body from the userinfo endpoint passes through without an explicit cast.
export type UserinfoClaimsInput = Dict;

/**
 * The REMOTE half of `ctx.auth.userinfo()` — a JSON body from the provider's
 * userinfo endpoint, which is untranslated wire and needs the translator.
 * {@link userinfoFromVerified} is the local twin, and both return the same shape.
 *
 * ⚠ `sensitive` is KEPT, which is the opposite of `parse-introspection.ts`, and
 * the difference is the question each answers. An introspection response answers
 * "may this request do this", so a government identifier volunteered into it has
 * no business reaching `ctx.state.access.claims`. A USERINFO response IS the
 * subject's identity — dropping a national identity number the provider chose to
 * release makes pylon answer with less than it was given.
 *
 * There is no OIDC Core §13.3 encryption gate here on purpose: that rule governs
 * TOKENS, and this input is a body that arrived over TLS, whose release the
 * authorization server already decided from the granted scope.
 */
export const parseUserinfo = (data: UserinfoClaimsInput): PylonUserinfo => {
  // `toDomain` buckets by registry category, so no claim-key list is kept here.
  const { claims, profile, sensitive } = Aegis.toDomain(data);

  if (!isString(claims.subject)) {
    throw new UserinfoEndpointFailed("Missing subject claim", {
      code: "userinfo_missing_subject",
      title: "Userinfo Missing Subject",
      details:
        "An OIDC userinfo response must include a string sub claim, which was missing or non-string.",
    });
  }

  return { ...profile, ...sensitive, subject: claims.subject };
};
