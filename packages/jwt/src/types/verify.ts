export interface IssuerVerifyOptions {
  audience: string;
  audiences: Array<string>;
  authorizedParty: string;
  clockTolerance: number;
  issuer: string;
  maxAge: string;
  nonce: string;
  permissions: Array<string>;
  scopes: Array<string>;
  subject: string;
  subjectHint: string;
  subjects: Array<string>;
  types: Array<string>;
}

export interface IssuerVerifyData<Payload, Claims> {
  id: string;
  active: boolean;
  audiences: Array<string>;
  authContextClass: Array<string>;
  authMethodsReference: Array<string>;
  authTime: number | null;
  authorizedParty: string | null;
  claims: Claims;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  levelOfAssurance: number | null;
  nonce: string | null;
  notBefore: number;
  now: number;
  payload: Payload;
  permissions: Array<string>;
  scopes: Array<string>;
  sessionId: string | null;
  subject: string;
  subjectHint: string | null;
  token: string;
  type: string;
  username: string | null;
}
