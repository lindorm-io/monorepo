import { DefaultLindormKoaContext } from "@lindorm-io/koa";
import { IssuerVerifyData } from "@lindorm-io/jwt";

export type CustomValidation<Context extends DefaultLindormKoaContext = DefaultLindormKoaContext> =
  (ctx: Context, verifyData: IssuerVerifyData<any, any>) => Promise<void>;
