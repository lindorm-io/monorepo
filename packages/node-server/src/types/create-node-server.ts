import { AmqpConnection, MessageBusBase } from "@lindorm-io/amqp";
import { KoaAppOptions } from "@lindorm-io/koa";
import { LindormNodeServerKoaContext } from "./context";
import { MemoryCacheConstructor, MemoryDatabase } from "@lindorm-io/in-memory-cache";
import { MongoConnection, MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { RedisConnection, RedisRepositoryConstructor } from "@lindorm-io/redis";

type ServiceOptions = {
  name: string;
  host: string;
  port: number | null;
};

type KeystoreOptions = {
  exposeExternal?: boolean;
  exposePublic?: boolean;
  keyPairMemory?: boolean;
  keyPairMongo?: boolean;
  keyPairRedis?: boolean;
};

export type CreateNodeServerOptions<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> = KoaAppOptions<Context> & {
  amqpConnection?: AmqpConnection;
  issuer?: string;
  keystore?: KeystoreOptions;
  memory?: Array<MemoryCacheConstructor>;
  memoryDatabase?: MemoryDatabase;
  messageBus?: typeof MessageBusBase;
  mongo?: Array<MongoRepositoryConstructor>;
  mongoConnection?: MongoConnection;
  redis?: Array<RedisRepositoryConstructor>;
  redisConnection?: RedisConnection;
  services?: Array<ServiceOptions>;
  useSocketRedisAdapter?: boolean;
};
