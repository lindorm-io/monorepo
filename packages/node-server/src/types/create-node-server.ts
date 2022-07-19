import { AmqpConnection } from "@lindorm-io/amqp";
import { CacheBase, RedisConnection } from "@lindorm-io/redis";
import { KoaAppOptions } from "@lindorm-io/koa";
import { LindormNodeServerKoaContext } from "./context";
import { MongoConnection, RepositoryBase } from "@lindorm-io/mongo";
import { MessageBusBase } from "@lindorm-io/amqp";

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
  amqpConnection?: AmqpConnection;
  caches?: Array<typeof CacheBase>;
  issuer?: string;
  keystore?: Keystore;
  messageBus?: typeof MessageBusBase;
  mongoConnection?: MongoConnection;
  redisConnection?: RedisConnection;
  repositories?: Array<typeof RepositoryBase>;
  services?: Array<Service>;
  useSocketRedisAdapter?: boolean; // default: true
}
