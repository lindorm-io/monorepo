import { CacheBase, RedisConnection } from "@lindorm-io/redis";
import { KoaAppOptions } from "@lindorm-io/koa";
import { LindormNodeServerKoaContext } from "./context";
import { MongoConnection, RepositoryBase } from "@lindorm-io/mongo";

interface Service {
  name: string;
  host: string;
  port: number | null;
}

interface Keystore {
  exposeExternal?: boolean;
  exposePublic?: boolean;
  keyPairCache?: boolean; // default: true
  keyPairRepository?: boolean; // default: false
}

export interface CreateNodeServerOptions<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> extends KoaAppOptions<Context> {
  caches?: Array<typeof CacheBase>;
  issuer?: string;
  keystore?: Keystore;
  mongoConnection?: MongoConnection;
  redisConnection?: RedisConnection;
  repositories?: Array<typeof RepositoryBase>;
  services?: Array<Service>;
  useSocketRedisAdapter?: boolean; // default: true
}
