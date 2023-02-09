import { DefaultLindormKoaContext } from "@lindorm-io/koa";
import { JwtDecodeData } from "@lindorm-io/jwt";

export type BearerTokenCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
> = (ctx: Context, verifyData: JwtDecodeData<any, any>) => Promise<void>;
