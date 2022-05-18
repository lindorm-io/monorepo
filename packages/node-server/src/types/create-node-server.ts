import { LindormNodeServerKoaContext } from "./context";
import { KoaAppOptions } from "@lindorm-io/koa";
import { CacheBase, RedisConnection } from "@lindorm-io/redis";
import { MongoConnection, RepositoryBase } from "@lindorm-io/mongo";

interface Service {
  name: string;
  host: string;
  port: number | null;
}

export interface CreateNodeServerOptions<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> extends KoaAppOptions<Context> {
  caches?: Array<typeof CacheBase>;
  isKeyPairCached?: boolean; // default: true
  isKeyPairInRepository?: boolean; // default: false
  issuer?: string;
  mongoConnection?: MongoConnection;
  redisConnection?: RedisConnection;
  repositories?: Array<typeof RepositoryBase>;
  services?: Array<Service>;
  useSocketRedisAdapter?: boolean; // default: true
}
