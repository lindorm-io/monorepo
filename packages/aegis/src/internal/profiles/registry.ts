import type { TokenProfile } from "../../types/index.js";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "./definitions/access-token.js";
import { clientAssertionProfile } from "./definitions/client-assertion.js";
import { defaultProfile } from "./definitions/default.js";
import { delegationProfile } from "./definitions/delegation.js";
import { erasureTokenProfile } from "./definitions/erasure-token.js";
import { idTokenProfile } from "./definitions/id-token.js";
import { introspectionProfile } from "./definitions/introspection.js";
import { jarmProfile } from "./definitions/jarm.js";
import { logoutTokenProfile } from "./definitions/logout-token.js";
import { securityEventProfile } from "./definitions/security-event.js";
import { userinfoProfile } from "./definitions/userinfo.js";

/**
 * Registry of token profiles, keyed by name. Built-ins are registered at
 * module load; custom profiles register via {@link registerProfile}. Later
 * chunks add the remaining built-ins (access_token, id_token, etc.).
 */
const registry = new Map<string, TokenProfile>();

export const registerProfile = (profile: TokenProfile): void => {
  registry.set(profile.name, profile);
};

export const resolveProfile = (name: string): TokenProfile => {
  const profile = registry.get(name);

  if (!profile) {
    throw new JwtError(`Unknown token profile: ${name}`, {
      code: "jwt_unknown_profile",
      data: { name },
      debug: { available: [...registry.keys()] },
      title: "JWT Unknown Profile",
      details:
        "No token profile is registered under that name. Register a custom profile with registerProfile() or use a built-in.",
    });
  }

  return profile;
};

registerProfile(accessTokenProfile);
registerProfile(clientAssertionProfile);
registerProfile(defaultProfile);
registerProfile(delegationProfile);
registerProfile(erasureTokenProfile);
registerProfile(idTokenProfile);
registerProfile(introspectionProfile);
registerProfile(jarmProfile);
registerProfile(logoutTokenProfile);
registerProfile(securityEventProfile);
registerProfile(userinfoProfile);
