import { AmqpConnection, MessageBusConstructor } from "@lindorm-io/amqp";
import { AxiosClientProperties } from "@lindorm-io/axios";
import { MemoryCacheConstructor, MemoryDatabase } from "@lindorm-io/in-memory-cache";
import { GenerateOptions, KeySetExportKeys } from "@lindorm-io/jwk";
import { KoaAppOptions } from "@lindorm-io/koa";
import { MongoConnection, MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { RedisConnection, RedisRepositoryConstructor } from "@lindorm-io/redis";
import { LindormNodeServerKoaContext } from "./context";

export type ServiceOptions = {
  name: string;
  host: string;
  port: number | null;
};

export type KeystoreOptions = {
  encOptions?: GenerateOptions;
  exportExternalKeys?: boolean;
  exportKeys?: KeySetExportKeys;
  jwks?: Array<ServiceOptions>;
  sigOptions?: GenerateOptions;
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
  messageBus?: Array<MessageBusConstructor>;
  mongo?: Array<MongoRepositoryConstructor>;
  mongoConnection?: MongoConnection;
  redis?: Array<RedisRepositoryConstructor>;
  redisConnection?: RedisConnection;
  services?: Array<ServiceOptions>;
  useSocketRedisAdapter?: boolean;
};
