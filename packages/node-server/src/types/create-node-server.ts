import { AmqpConnection, MessageBusBase } from "@lindorm-io/amqp";
import { KoaAppOptions } from "@lindorm-io/koa";
import { LindormNodeServerKoaContext } from "./context";
import { MemoryCacheConstructor, MemoryDatabase } from "@lindorm-io/in-memory-cache";
import { MongoConnection, MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { RedisConnection, RedisRepositoryConstructor } from "@lindorm-io/redis";
import { KeyType } from "@lindorm-io/key-pair";
import { AxiosClientProperties } from "@lindorm-io/axios";

export type ServiceOptions = {
  name: string;
  host: string;
  port: number | null;
};

export type KeystoreOptions = {
  exposed?: Array<"external" | "public">;
  generated?: Array<KeyType>;
  jwks?: Array<ServiceOptions>;
  storage?: Array<"memory" | "mongo" | "redis">;
};

export type CreateNodeServerOptions<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> = KoaAppOptions<Context> & {
  amqpConnection?: AmqpConnection;
  client?: Partial<AxiosClientProperties>;
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
