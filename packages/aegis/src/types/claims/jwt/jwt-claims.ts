import { ConfirmationClaimWire } from "./confirmation-claim-wire";
import { ExtendedClaimsWire } from "./extended-claims-wire";
import { LindormClaimsWire } from "./lindorm-claims-wire";
import { OidcClaimsWire } from "./oidc-claims-wire";
import { StdClaimsWire } from "./std-claims-wire";

// https://datatracker.ietf.org/doc/html/rfc7800
type CnfClaimsWire = {
  cnf?: ConfirmationClaimWire;
};

export type JwtClaims = StdClaimsWire &
  OidcClaimsWire &
  CnfClaimsWire &
  ExtendedClaimsWire &
  LindormClaimsWire;
