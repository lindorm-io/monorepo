import { Expiry } from "@lindorm-io/core";

export interface IssuerSignOptions<Payload, Claims> {
  id?: string;
  audiences: Array<string>;
  authContextClass?: Array<string>;
  authMethodsReference?: Array<string>;
  authTime?: number;
  authorizedParty?: string;
  claims?: Claims;
  expiry: Expiry;
  levelOfAssurance?: number;
  nonce?: string;
  notBefore?: Date;
  payload?: Payload;
  permissions?: Array<string>;
  scopes?: Array<string>;
  sessionId?: string;
  subject: string;
  subjectHint?: string;
  type: string;
  username?: string;
}

export interface IssuerSignData {
  id: string;
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  token: string;
}
