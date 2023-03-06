import { DefaultLindormKoaContext } from "@lindorm-io/koa";
import { JwtDecodeData } from "@lindorm-io/jwt";

export type BearerTokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Claims = any,
> = (ctx: Context, verifyData: JwtDecodeData<Claims>) => Promise<void>;
