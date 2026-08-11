import type { DelegationClaims } from "./delegation-claims.js";
import type { LindormClaims } from "./lindorm-claims.js";
import type { OAuthClaims } from "./oauth-claims.js";
import type { OidcClaims } from "./oidc-claims.js";
import type { PopClaims } from "./pop-claims.js";
import type { RarClaims } from "./rar-claims.js";
import type { SetClaims } from "./set-claims.js";
import type { StdClaims } from "./std-claims.js";

/**
 * The unified domain claim set carried by `VerifiedToken.claims` /
 * `ParsedToken.claims` — the RFC-grouped intersection that token verification,
 * introspection parsing and userinfo parsing all share.
 *
 * Of {@link SetClaims} only `subjectId` has a wire/domain name split (`sub_id`,
 * RFC 9493); `events` keeps its wire key and is not part of this set.
 *
 * ⚠ This type and the claim registry's `domainClaim` marks describe the SAME set
 * from two directions — the type says what a consumer receives, the marks say what
 * the floor read resolves. `claims-registry.test.ts` binds them to each other, so
 * adding a claim to one without the other is a build failure rather than a silent
 * divergence.
 */
export type DomainClaims = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  RarClaims &
  LindormClaims &
  Pick<SetClaims, "subjectId">;
