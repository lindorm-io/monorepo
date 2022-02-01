export interface IssuerDecodedClaims<Payload, Claims> {
  id: string;
  audiences: Array<string>;
  authContextClass: Array<string>;
  authMethodsReference: Array<string>;
  authTime: number | null;
  authorizedParty: string | null;
  claims: Claims;
  levelOfAssurance: number | null;
  nonce: string | null;
  payload: Payload;
  permissions: Array<string>;
  scopes: Array<string>;
  sessionId: string | null;
  subject: string;
  subjectHint: string | null;
  type: string;
  username: string | null;
}

export interface IssuerDecodeData<Payload, Claims> extends IssuerDecodedClaims<Payload, Claims> {
  active: boolean;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  keyId: string;
  notBefore: number;
  now: number;
}
