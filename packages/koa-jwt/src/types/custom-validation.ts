import { JwtVerifyData } from "@lindorm-io/jwt";
import { DefaultLindormKoaContext } from "@lindorm-io/koa";

export type TokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> = (ctx: Context, verifyData: JwtVerifyData<any, any>) => Promise<void>;
