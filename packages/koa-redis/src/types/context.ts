import { LindormEntity } from "@lindorm-io/entity";
import { KoaContext } from "@lindorm-io/koa";
import { LindormCache, RedisConnection } from "@lindorm-io/redis";

export interface RedisContext extends KoaContext {
  cache: Record<string, LindormCache<any, LindormEntity<any>>>;
  connection: {
    redis: RedisConnection;
  };
  entity: Record<string, LindormEntity<any>>;
}
