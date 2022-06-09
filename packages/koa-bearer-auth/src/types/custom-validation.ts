import { DefaultLindormKoaContext } from "@lindorm-io/koa";
import { JwtVerifyData } from "@lindorm-io/jwt";

export type BearerTokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> = (ctx: Context, verifyData: JwtVerifyData<any, any>) => Promise<void>;
