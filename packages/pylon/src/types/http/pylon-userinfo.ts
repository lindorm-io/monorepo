import type { AegisProfile } from "@lindorm/aegis";

// OIDC userinfo response as resolved by ctx.auth.userinfo(). Pylon owns this
// shape (moved out of @lindorm/aegis): the user's profile claims plus the
// mandatory subject. The profile field set comes from AegisProfile, which Aegis
// still owns as the ID-token profile-claim surface.
export type PylonUserinfo = AegisProfile & {
  subject: string;
};
