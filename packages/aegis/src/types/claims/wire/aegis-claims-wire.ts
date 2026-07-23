import type { DelegationClaimsWire } from "./delegation-claims-wire.js";
import type { LindormClaimsWire } from "./lindorm-claims-wire.js";
import type { OAuthClaimsWire } from "./oauth-claims-wire.js";
import type { OidcClaimsWire } from "./oidc-claims-wire.js";
import type { PopClaimsWire } from "./pop-claims-wire.js";
import type { RarClaimsWire } from "./rar-claims-wire.js";
import type { SetClaimsWire } from "./set-claims-wire.js";
import type { StdClaimsWire } from "./std-claims-wire.js";

// The CLOSED wire-claim base shared by JOSE and COSE (was `JwtClaims`): every
// REGISTERED claim hard-typed to its wire form, keyed by its semantic ownership
// (StdClaims = RFC 7519, OidcClaims = OIDC Core, PopClaims = RFC 7800,
// DelegationClaims = RFC 8693, OAuthClaims = RFC 9068, LindormClaims =
// proprietary). `JwtClaimsWire` opens it with an index signature; `CwtClaimsWire`
// derives the COSE flavour (jti→cti) off it. The sensitive identity claims travel
// FLAT (registry `category: "sensitive"`), so they are ordinary wire keys, not a
// member here.
export type AegisClaimsWire = StdClaimsWire &
  OidcClaimsWire &
  PopClaimsWire &
  DelegationClaimsWire &
  OAuthClaimsWire &
  RarClaimsWire &
  SetClaimsWire &
  LindormClaimsWire;
