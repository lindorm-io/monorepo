export interface DefaultClaims {
  aud: Array<string>; // audience
  exp: number; // expires at
  iat: number; // issued at
  iss: string; // issuer
  jti: string; // id
  nbf: number; // not before
  sub: string; // subject
}

export interface StandardClaims extends DefaultClaims {
  acr?: Array<string>; // authentication context class reference
  amr?: Array<string>; // authentication methods reference
  auth_time?: number; // time when authentication was performed
  azp?: string; // authorized party
  nonce?: string;
  sid?: string; // session id
  token_type: string;
  usr?: string; // username
}

export interface LindormClaims extends StandardClaims {
  aal?: number; // adjusted access level
  ext?: Record<string, any>; // payload
  iam?: Array<string>; // permissions
  loa?: number; // level of assurance
  scp?: Array<string>; // scope
  sih?: string; // session hint
  suh?: string; // subject hint
}
