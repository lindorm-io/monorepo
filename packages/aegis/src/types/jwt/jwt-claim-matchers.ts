import { PredicateOperator } from "@lindorm/types";

export type JwtClaimMatchers = {
  accessToken?: string;
  adjustedAccessLevel?: PredicateOperator<number>;
  audience?: Array<string> | string | PredicateOperator<any>;
  authCode?: string;
  authContextClass?: string | PredicateOperator<string>;
  authFactor?: string | PredicateOperator<string>;
  authMethods?: Array<string> | string | PredicateOperator<any>;
  authorizedParty?: string | PredicateOperator<string>;
  authState?: string;
  authTime?: PredicateOperator<Date>;
  clientId?: Array<string> | string | PredicateOperator<any>;
  entitlements?: Array<string> | string | PredicateOperator<any>;
  grantType?: string | PredicateOperator<string>;
  groups?: Array<string> | string | PredicateOperator<any>;
  issuer?: string | PredicateOperator<string>;
  levelOfAssurance?: number | PredicateOperator<number>;
  nonce?: string | PredicateOperator<string>;
  permissions?: Array<string> | string | PredicateOperator<any>;
  roles?: Array<string> | string | PredicateOperator<any>;
  scope?: Array<string> | string | PredicateOperator<any>;
  sessionHint?: Array<string> | string | PredicateOperator<any>;
  subject?: Array<string> | string | PredicateOperator<any>;
  subjectHint?: string | PredicateOperator<string>;
  tenantId?: Array<string> | string | PredicateOperator<any>;
};
