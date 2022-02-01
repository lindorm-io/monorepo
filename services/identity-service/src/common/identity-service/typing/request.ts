import { IdentifierType } from "../enum";
import { OpenIDClaims } from "./openid";

export interface AuthenticateIdentifierRequestData {
  identifier: string;
  identityId?: string;
  provider?: string;
  type: IdentifierType;
}

export interface GetUserinfoRequestBody {
  id: string;
  scope: string;
}

export interface AddUserinfoRequestBody extends OpenIDClaims {
  provider: string;
}
