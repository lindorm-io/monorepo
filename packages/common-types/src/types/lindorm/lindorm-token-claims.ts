import { StandardJwtClaims } from "../jwt";
import { OpenIdTokenClaims } from "../open-id";

type CustomClaims = {
  aal?: number; // adjusted access level
  afr?: string; // auth factor reference
  cid?: string; // client id
  gty?: string; // grant type
  loa?: number; // level of assurance
  rls?: Array<string>; // roles
  scope?: string; // scopes
  sid?: string; // session id
  sih?: string; // session hint
  suh?: string; // subject hint
  tid?: string; // tenant id
  token_type: string;
  usr?: string; // username
};

export type LindormTokenClaims = StandardJwtClaims & OpenIdTokenClaims & CustomClaims;
