import { KeyType } from "@lindorm-io/key-pair";
import { Expiry } from "@lindorm-io/core";

export interface JwtSignOptions<Payload = never, Claims = never> {
  id?: string;
  adjustedAccessLevel?: number;
  audiences: Array<string>;
  authContextClass?: Array<string>;
  authMethodsReference?: Array<string>;
  authTime?: number;
  authorizedParty?: string;
  claims?: Claims;
  expiry: Expiry;
  keyType?: KeyType;
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

export interface JwtSignData {
  id: string;
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  token: string;
}
