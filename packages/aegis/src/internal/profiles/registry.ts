import type { TokenProfile, TokenProfileInput } from "../../types/index.js";
import { AegisDomainError } from "../../errors/index.js";
import { defineProfile } from "./define-profile.js";
import { accessTokenProfile } from "./definitions/access-token.js";
import { defaultProfile } from "./definitions/default.js";
import { delegationProfile } from "./definitions/delegation.js";
import { erasureTokenProfile } from "./definitions/erasure-token.js";
import { externalAccessTokenProfile } from "./definitions/external-access-token.js";
import { idTokenProfile } from "./definitions/id-token.js";
import { introspectionProfile } from "./definitions/introspection.js";
import { jarmProfile } from "./definitions/jarm.js";
import { logoutTokenProfile } from "./definitions/logout-token.js";
import { securityEventProfile } from "./definitions/security-event.js";
import { userinfoProfile } from "./definitions/userinfo.js";

/**
 * The built-in descriptors, in one array — the set every registry is seeded
 * from, and the only place a profile becomes a built-in.
 *
 * Exported so a test can ENUMERATE the built-ins rather than restate them: a
 * hand-written list of "every profile that does X" undercounts the moment a
 * twelfth profile lands, and did — a list claiming every profile requiring
 * `audience` held seven of the ten.
 */
export const BUILT_IN_PROFILES: ReadonlyArray<TokenProfile> = [
  accessTokenProfile,
  defaultProfile,
  delegationProfile,
  erasureTokenProfile,
  externalAccessTokenProfile,
  idTokenProfile,
  introspectionProfile,
  jarmProfile,
  logoutTokenProfile,
  securityEventProfile,
  userinfoProfile,
];

export type ProfileRegistry = {
  /**
   * Registers a profile under its own name. The descriptor goes through
   * `defineProfile` so a runtime-registered profile is resolved exactly as a
   * built-in is — `resolve` never hands a consumer an unresolved `use`.
   */
  register: (profile: TokenProfileInput) => void;
  resolve: (name: string) => TokenProfile;
};

/**
 * A profile table belonging to ONE `Aegis`. It was module-global, so a consumer
 * registering a custom profile — or one that shadowed a built-in — changed what
 * every other `Aegis` in the process minted and verified, including ones
 * constructed by an unrelated library. Registration is now scoped to the
 * instance it was called on.
 *
 * The built-ins are seeded per registry from the SAME frozen descriptors, so
 * they cost one map insertion each and no instance can mutate another's.
 */
export const createProfileRegistry = (): ProfileRegistry => {
  const registry = new Map<string, TokenProfile>(
    BUILT_IN_PROFILES.map((profile) => [profile.name, profile]),
  );

  return {
    register: (profile) => {
      registry.set(profile.name, defineProfile(profile));
    },

    resolve: (name) => {
      const profile = registry.get(name);

      if (!profile) {
        throw new AegisDomainError(`Unknown token profile: ${name}`, {
          code: "unknown_profile",
          data: { name },
          debug: { available: [...registry.keys()] },
          title: "Unknown Profile",
          details:
            "No token profile is registered under that name. Register a custom profile with registerProfile() or use a built-in.",
        });
      }

      return profile;
    },
  };
};
