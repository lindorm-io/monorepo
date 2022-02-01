import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import { KoaContext } from "@lindorm-io/koa";

export interface BearerAuthContext extends KoaContext {
  jwt: TokenIssuer;
  token: Record<string, IssuerVerifyData<unknown, unknown>>;
}
