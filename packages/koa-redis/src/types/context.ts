import { IRedisConnection } from "@lindorm-io/redis";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormRedisContext extends DefaultLindormContext {
  connection: {
    redis: IRedisConnection;
  };
}

export type DefaultLindormRedisKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormRedisContext>
>;

export type DefaultLindormRedisSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormRedisContext>
>;
