import { KeyType } from "@lindorm-io/key-pair";
import { Expiry } from "@lindorm-io/core";
import { LevelOfAssurance } from "./loa";

export type JwtSignOptions<Payload = never, Claims = never> = {
  id?: string;
  adjustedAccessLevel?: LevelOfAssurance;
  audiences: Array<string>;
  authContextClass?: Array<string>;
  authMethodsReference?: Array<string>;
  authTime?: number;
  authorizedParty?: string;
  claims?: Claims;
  expiry: Expiry;
  keyType?: KeyType;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
  notBefore?: Date;
  payload?: Payload;
  permissions?: Array<string>;
  scopes?: Array<string>;
  sessionId?: string;
  sessionHint?: string;
  subject: string;
  subjectHint?: string;
  type: string;
  username?: string;
};

export type JwtSignData = {
  id: string;
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  token: string;
};
