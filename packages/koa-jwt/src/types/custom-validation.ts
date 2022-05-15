import { IssuerVerifyData } from "@lindorm-io/jwt";
import { DefaultLindormKoaContext } from "@lindorm-io/koa";

export type CustomValidation<Context extends DefaultLindormKoaContext = DefaultLindormKoaContext> =
  (ctx: Context, verifyData: IssuerVerifyData<any, any>) => Promise<void>;
