import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Expiry } from "@lindorm-io/expiry";
import { KeyType } from "@lindorm-io/key-pair";

export type JwtSignOptions<Payload = never, Claims = never> = {
  id?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  audiences: Array<string>;
  authContextClass?: string;
  authMethodsReference?: Array<string>;
  authTime?: number;
  authorizedParty?: string;
  claims?: Claims;
  client?: string;
  expiry: Expiry;
  issuedAt?: Date;
  keyType?: KeyType;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
  notBefore?: Date;
  payload?: Payload;
  scopes?: Array<string>;
  session?: string;
  sessionHint?: string;
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
