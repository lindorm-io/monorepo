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
  aal?: number; // adjusted access level
  acr?: Array<string>; // authentication context class reference
  amr?: Array<string>; // authentication methods reference
  auth_time?: number; // time when authentication was performed
  azp?: string; // authorized party
  ext?: Record<string, any>; // payload
  iam?: Array<string>; // permissions
  loa?: number; // level of assurance
  nonce?: string;
  scp?: Array<string>; // scope
  sid?: string; // session id
  suh?: string; // subject hint
  token_type: string;
  usr?: string; // username
}
