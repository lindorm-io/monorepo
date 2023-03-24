import { IRedisConnection } from "./redis-connection";
import { Logger } from "@lindorm-io/core-logger";
import { RedisRepository } from "./redis-repository";
import { RedisDocument, RedisEntity } from "./redis-document";

export type RedisRepositoryConstructor<
  Document extends RedisDocument = any,
  Entity extends RedisEntity = any,
> = new (connection: IRedisConnection, logger: Logger) => RedisRepository<Document, Entity>;
