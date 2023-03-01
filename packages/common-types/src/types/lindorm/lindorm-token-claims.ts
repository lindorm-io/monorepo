import { OpenIdTokenClaims } from "../open-id";
import { StandardJwtClaims } from "../jwt";

type CustomClaims = {
  aal?: number; // adjusted access level
  cid?: string; // client id
  ext?: Record<string, any>; // payload
  loa?: number; // level of assurance
  scp?: Array<string>; // scope
  sih?: string; // session hint
  suh?: string; // subject hint
  tid?: string; // tenant id
};

export type LindormTokenClaims = StandardJwtClaims & OpenIdTokenClaims & CustomClaims;
