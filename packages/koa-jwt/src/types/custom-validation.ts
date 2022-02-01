import { IssuerVerifyData } from "@lindorm-io/jwt";
import { KoaContext } from "@lindorm-io/koa";
import { TokenIssuerContext } from "./context";

export type CustomValidation<Context extends KoaContext = TokenIssuerContext> = (
  ctx: Context,
  verifyData: IssuerVerifyData<any, any>,
) => Promise<void>;
