import { IMongoConnection } from "./mongo-connection";
import { Logger } from "@lindorm-io/core-logger";
import { MongoDocument, MongoEntity } from "./mongo-document";
import { MongoRepository } from "./mongo-repository";

export type MongoRepositoryConstructor<
  Document extends MongoDocument = any,
  Entity extends MongoEntity = any,
> = new (connection: IMongoConnection, logger: Logger) => MongoRepository<Document, Entity>;
