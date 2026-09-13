import type { DelegationClaims } from "./delegation-claims.js";
import type { LindormClaims } from "./lindorm-claims.js";
import type { OAuthClaims } from "./oauth-claims.js";
import type { OidcClaims } from "./oidc-claims.js";
import type { PopClaims } from "./pop-claims.js";
import type { RarClaims } from "./rar-claims.js";
import type { SetClaims } from "./set-claims.js";
import type { StdClaims } from "./std-claims.js";

/**
 * The claim set the verify FLOOR read resolves — the RFC-grouped intersection
 * {@link TokenClaims} is built on.
 *
 * Of {@link SetClaims} this set picks only `subjectId` (`sub_id`, RFC 9493 §4.1);
 * the floor leaves `events` and `transactionId` in `custom` under their wire
 * keys, so they belong to {@link TokenClaims} and not here.
 *
 * ⚠ This type and the claim registry's `domainClaim` marks describe the SAME set
 * from two directions — the type names it, the marks select it out of the
 * registry. `claims-registry.test.ts` binds them to each other, so adding a claim
 * to one without the other is a build failure rather than a silent divergence.
 */
export type DomainClaims = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  RarClaims &
  LindormClaims &
  Pick<SetClaims, "subjectId">;

/**
 * The claim set a TOKEN read carries — the type of `VerifiedToken.claims` and
 * `ParsedToken.claims`. The token read resolves EVERY registered claim and the
 * sensitive extraction lifts the sensitive names into their own bag, so this is
 * the `bucket: "claims"` set less those names: {@link DomainClaims} plus `events`
 * and `transactionId` (RFC 8417 §2.2).
 *
 * ⚠ The registry decides this set, not this declaration: `claims-registry.test.ts`
 * censuses every `bucket: "claims"` entry the sensitive extraction leaves behind
 * against these keys, so a registered claim the type does not name is a red test.
 */
export type TokenClaims = DomainClaims & Pick<SetClaims, "events" | "transactionId">;
