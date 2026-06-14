import type { DelegationClaimsWire } from "./delegation-claims-wire.js";
import type { LindormClaimsWire } from "./lindorm-claims-wire.js";
import type { OAuthClaimsWire } from "./oauth-claims-wire.js";
import type { OidcClaimsWire } from "./oidc-claims-wire.js";
import type { PopClaimsWire } from "./pop-claims-wire.js";
import type { RarClaimsWire } from "./rar-claims-wire.js";
import type { SetClaimsWire } from "./set-claims-wire.js";
import type { SensitiveIdentityClaimWire } from "./sensitive-identity-claim-wire.js";
import type { StdClaimsWire } from "./std-claims-wire.js";

// Wire-form composition matching the domain-form ParsedJwtPayload
// composition. Each claim group is keyed by its semantic ownership
// (StdClaims = RFC 7519, OidcClaims = OIDC Core, PopClaims = RFC 7800,
// DelegationClaims = RFC 8693, OAuthClaims = RFC 9068, LindormClaims =
// proprietary, SensitiveIdentityClaim = proprietary nested PII claim).
export type JwtClaims = StdClaimsWire &
  OidcClaimsWire &
  PopClaimsWire &
  DelegationClaimsWire &
  OAuthClaimsWire &
  RarClaimsWire &
  SetClaimsWire &
  LindormClaimsWire &
  SensitiveIdentityClaimWire;
