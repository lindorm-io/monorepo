import { JwtVerify } from "@lindorm-io/jwt";
import { DefaultLindormKoaContext } from "@lindorm-io/koa";

export type BearerTokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Claims = any,
> = (ctx: Context, verifyData: JwtVerify<Claims>) => Promise<void>;
