import { TokenIssuer } from "@lindorm-io/jwt";
import { Keystore } from "@lindorm-io/key-pair";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormJwtContext extends DefaultLindormContext {
  jwt: TokenIssuer;
  keystore: Keystore;
}

export type DefaultLindormJwtKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormJwtContext>
>;

export type DefaultLindormJwtSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormJwtContext>
>;
