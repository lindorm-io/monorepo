import { OpenIDClaims } from "../openid";

export interface AddUserinfoRequestBody extends OpenIDClaims {
  provider: string;
}
