import { JWT } from "@lindorm-io/jwt";
import { Keystore } from "@lindorm-io/keystore";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormJwtContext extends DefaultLindormContext {
  jwt: JWT;
  keystore: Keystore;
}

export type DefaultLindormJwtKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormJwtContext>
>;

export type DefaultLindormJwtSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormJwtContext>
>;
