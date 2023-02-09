import { JwtDecodeData } from "@lindorm-io/jwt";
import { DefaultLindormKoaContext } from "@lindorm-io/koa";

export type TokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> = (ctx: Context, verifyData: JwtDecodeData<any, any>) => Promise<void>;
