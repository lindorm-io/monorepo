import { OauthTokenClaims } from "../oauth";
import { StandardTokenClaims } from "../token";

type CustomClaims = {
  aal?: number; // adjusted access level
  ext?: Record<string, any>; // payload
  loa?: number; // level of assurance
  scp?: Array<string>; // scope
  sih?: string; // session hint
  suh?: string; // subject hint
  tid?: string; // tenant id
};

export type LindormTokenClaims = StandardTokenClaims & OauthTokenClaims & CustomClaims;
