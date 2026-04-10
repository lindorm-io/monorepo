import { ConfirmationClaimWire } from "./jwt-confirmation";
import { ExtendedClaimsWire } from "./jwt-extended-claims";
import { LindormClaimsWire } from "./jwt-lindorm-claims";
import { OidcClaimsWire } from "./jwt-oidc-claims";
import { StdClaimsWire } from "./jwt-std-claims";

export type AuthFactor = "knowledge" | "possession" | "inherence" | (string & {});

export type SessionHint =
  | "web"
  | "mobile"
  | "cli"
  | "service"
  | "machine"
  | (string & {});

export type SubjectHint = "user" | "client" | "service" | "device" | (string & {});

// https://datatracker.ietf.org/doc/html/rfc7800
type CnfClaimsWire = {
  cnf?: ConfirmationClaimWire;
};

export type JwtClaims = StdClaimsWire &
  OidcClaimsWire &
  CnfClaimsWire &
  ExtendedClaimsWire &
  LindormClaimsWire;
