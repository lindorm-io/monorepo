import type { accessTokenProfile } from "../../internal/profiles/definitions/access-token.js";
import type { defaultProfile } from "../../internal/profiles/definitions/default.js";
import type { delegationProfile } from "../../internal/profiles/definitions/delegation.js";
import type { erasureTokenProfile } from "../../internal/profiles/definitions/erasure-token.js";
import type { externalAccessTokenProfile } from "../../internal/profiles/definitions/external-access-token.js";
import type { idTokenProfile } from "../../internal/profiles/definitions/id-token.js";
import type { introspectionProfile } from "../../internal/profiles/definitions/introspection.js";
import type { jarmProfile } from "../../internal/profiles/definitions/jarm.js";
import type { logoutTokenProfile } from "../../internal/profiles/definitions/logout-token.js";
import type { securityEventProfile } from "../../internal/profiles/definitions/security-event.js";
import type { userinfoProfile } from "../../internal/profiles/definitions/userinfo.js";

/**
 * Maps each built-in profile NAME to its concrete definition type, whose literal
 * `required` tuple the narrowed result type reads to narrow the verified claims.
 * The typed `verify` overload keys off this, so `aegis.verify("access_token", …)`
 * returns claims with non-optional `subject`/`expiresAt`/…, while a custom
 * (runtime-registered) profile falls through to the base `VerifiedToken`.
 *
 * Public because it appears in `IAegis.verify`'s own signature — a consumer
 * writing a wrapper around the profiled overload has to name it.
 */
export type BuiltInProfiles = {
  access_token: typeof accessTokenProfile;
  default: typeof defaultProfile;
  delegation: typeof delegationProfile;
  erasure_token: typeof erasureTokenProfile;
  external_access_token: typeof externalAccessTokenProfile;
  id_token: typeof idTokenProfile;
  introspection: typeof introspectionProfile;
  jarm: typeof jarmProfile;
  logout_token: typeof logoutTokenProfile;
  security_event: typeof securityEventProfile;
  userinfo: typeof userinfoProfile;
};
