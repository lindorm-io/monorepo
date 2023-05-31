import { JwtDecodeResult } from "@lindorm-io/jwt";
import { DefaultLindormKoaContext } from "@lindorm-io/koa";

export type BearerTokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Claims = any,
> = (ctx: Context, verifyData: JwtDecodeResult<Claims>) => Promise<void>;
