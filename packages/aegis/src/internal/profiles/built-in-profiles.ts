import type { accessTokenProfile } from "./definitions/access-token.js";
import type { defaultProfile } from "./definitions/default.js";
import type { delegationProfile } from "./definitions/delegation.js";
import type { erasureTokenProfile } from "./definitions/erasure-token.js";
import type { idTokenProfile } from "./definitions/id-token.js";
import type { introspectionProfile } from "./definitions/introspection.js";
import type { jarmProfile } from "./definitions/jarm.js";
import type { logoutTokenProfile } from "./definitions/logout-token.js";
import type { securityEventProfile } from "./definitions/security-event.js";
import type { userinfoProfile } from "./definitions/userinfo.js";

/**
 * Maps each built-in profile NAME to its concrete definition type, whose
 * literal `required` tuple {@link NarrowedJwt} reads to narrow the parsed
 * payload. The typed `verify` overload keys off this so
 * `aegis.verify("access_token", …)` returns a payload with non-optional
 * `subject`/`expiresAt`/… while a custom (runtime-registered) profile falls
 * through to the base {@link ParsedJwt}. Kept in lockstep with the registry's
 * `registerProfile` calls.
 */
export type BuiltInProfiles = {
  access_token: typeof accessTokenProfile;
  default: typeof defaultProfile;
  delegation: typeof delegationProfile;
  erasure_token: typeof erasureTokenProfile;
  id_token: typeof idTokenProfile;
  introspection: typeof introspectionProfile;
  jarm: typeof jarmProfile;
  logout_token: typeof logoutTokenProfile;
  security_event: typeof securityEventProfile;
  userinfo: typeof userinfoProfile;
};
