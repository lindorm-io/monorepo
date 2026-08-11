import type { AegisProfile, AegisSensitive } from "@lindorm/aegis";

// OIDC userinfo response as resolved by ctx.auth.userinfo(). Pylon owns this
// shape (moved out of @lindorm/aegis): the user's profile claims plus the
// mandatory subject. The profile field set comes from AegisProfile, which Aegis
// still owns as the ID-token profile-claim surface.
//
// AegisSensitive (government-issued identifiers) is part of the answer, and
// pylon needs NO gate of its own for it: aegis surfaces the `sensitive` bucket
// ONLY from an ENCRYPTED token (jwe/cwe) and suppresses it otherwise, per OIDC
// Core §13.3. On any other token the bucket is `undefined` and spreading it is a
// no-op — so the release condition is enforced once, upstream, and inherited
// here. Every field is optional, so nothing about the existing shape changes.
export type PylonUserinfo = AegisProfile &
  AegisSensitive & {
    subject: string;
  };
