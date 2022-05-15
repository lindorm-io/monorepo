import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

interface Context extends DefaultLindormContext {
  jwt: TokenIssuer;
  token: Record<string, IssuerVerifyData<unknown, unknown>>;
}

export type DefaultLindormBearerAuthKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<Context>
>;

export type DefaultLindormBearerAuthSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<Context>
>;
