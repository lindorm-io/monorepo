import { OpenIdTokenClaims } from "../open-id";
import { StandardJwtClaims } from "../jwt";

type CustomClaims = {
  aal?: number; // adjusted access level
  afr?: string; // auth factor reference
  cid?: string; // client id
  loa?: number; // level of assurance
  scope?: string;
  sid?: string; // session id
  sih?: string; // session hint
  suh?: string; // subject hint
  tid?: string; // tenant id
  token_type: string;
  usr?: string; // username
};

export type LindormTokenClaims = StandardJwtClaims & OpenIdTokenClaims & CustomClaims;
