import { Operators } from "../operators";

export type VerifyJwtOptions = {
  accessToken?: string;
  adjustedAccessLevel?: Operators;
  audience?: Array<string> | string | Operators;
  authCode?: string;
  authContextClass?: string | Operators;
  authFactor?: string | Operators;
  authMethods?: Array<string> | string | Operators;
  authorizedParty?: string | Operators;
  authState?: string;
  authTime?: Operators;
  clientId?: Array<string> | string | Operators;
  grantType?: string | Operators;
  issuer?: string | Operators;
  levelOfAssurance?: number | Operators;
  nonce?: string | Operators;
  permissions?: Array<string> | string | Operators;
  roles?: Array<string> | string | Operators;
  scope?: Array<string> | string | Operators;
  sessionHint?: Array<string> | string | Operators;
  subject?: Array<string> | string | Operators;
  subjectHint?: string | Operators;
  tenantId?: Array<string> | string | Operators;
  tokenType?: string | Operators;
};
