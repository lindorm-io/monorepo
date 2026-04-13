import { DelegationClaimsWire } from "./delegation-claims-wire";
import { LindormClaimsWire } from "./lindorm-claims-wire";
import { OAuthClaimsWire } from "./oauth-claims-wire";
import { OidcClaimsWire } from "./oidc-claims-wire";
import { PopClaimsWire } from "./pop-claims-wire";
import { StdClaimsWire } from "./std-claims-wire";

// Wire-form composition matching the domain-form ParsedJwtPayload
// composition. Each claim group is keyed by its semantic ownership
// (StdClaims = RFC 7519, OidcClaims = OIDC Core, PopClaims = RFC 7800,
// DelegationClaims = RFC 8693, OAuthClaims = RFC 9068, LindormClaims =
// proprietary).
export type JwtClaims = StdClaimsWire &
  OidcClaimsWire &
  PopClaimsWire &
  DelegationClaimsWire &
  OAuthClaimsWire &
  LindormClaimsWire;
