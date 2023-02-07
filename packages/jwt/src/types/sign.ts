import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Expiry } from "@lindorm-io/expiry";
import { KeyType } from "@lindorm-io/key-pair";

export type JwtSignOptions<Payload = never, Claims = never> = {
  id?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
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
  scopes?: Array<string>;
  sessionHint?: string;
  sessionId?: string;
  subject: string;
  subjectHint?: string;
  tenant?: string;
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
