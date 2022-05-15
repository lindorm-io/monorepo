import { LindormEntity } from "@lindorm-io/entity";
import { LindormCache, RedisConnection } from "@lindorm-io/redis";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormRedisContext extends DefaultLindormContext {
  cache: Record<string, LindormCache<any, LindormEntity<any>>>;
  connection: {
    redis: RedisConnection;
  };
  entity: Record<string, LindormEntity<any>>;
}

export type DefaultLindormRedisKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormRedisContext>
>;

export type DefaultLindormRedisSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormRedisContext>
>;
