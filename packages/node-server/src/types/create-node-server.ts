import { LindormNodeServerKoaContext } from "./context";
import { KoaAppOptions } from "@lindorm-io/koa";
import { CacheBase, RedisConnection } from "@lindorm-io/redis";
import { MongoConnection, RepositoryBase } from "@lindorm-io/mongo";

export interface CreateNodeServerOptions<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> extends KoaAppOptions<Context> {
  caches?: Array<typeof CacheBase>;
  isKeyPairCached?: boolean;
  isKeyPairInRepository?: boolean;
  mongoConnection?: MongoConnection;
  redisConnection?: RedisConnection;
  repositories?: Array<typeof RepositoryBase>;
}
