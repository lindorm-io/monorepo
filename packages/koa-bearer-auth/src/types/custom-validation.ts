import { BearerAuthContext } from "./context";
import { IssuerVerifyData } from "@lindorm-io/jwt";
import { KoaContext } from "@lindorm-io/koa";

export type CustomValidation<Context extends KoaContext = BearerAuthContext> = (
  ctx: Context,
  verifyData: IssuerVerifyData<any, any>,
) => Promise<void>;
