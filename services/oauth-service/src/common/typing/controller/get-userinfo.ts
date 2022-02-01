import { IdentityServiceClaims } from "../claims";

export interface GetUserinfoRequestBody {
  id: string;
  scope: string;
}

export interface GetUserinfoResponseBody {
  active: boolean;
  claims: Partial<IdentityServiceClaims>;
  permissions: Array<string>;
}
