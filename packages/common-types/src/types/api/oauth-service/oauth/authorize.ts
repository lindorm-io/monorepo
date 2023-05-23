import { OpenIdAuthorizeRequestQuery } from "../../../open-id";

export type AuthorizeRequestQuery = OpenIdAuthorizeRequestQuery & {
  country?: string; // custom for lindorm.io
  redirectData?: string; // custom for lindorm.io
};
