import { IdentityServiceClaims } from "./claims";

export interface AuthenticateIdentifierResponseBody {
  identityId: string;
}

export interface GetUserinfoResponseBody {
  active: boolean;
  claims: Partial<IdentityServiceClaims>;
  permissions: Array<string>;
}
