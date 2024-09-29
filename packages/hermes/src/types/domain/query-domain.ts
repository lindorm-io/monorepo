import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";

export type QueryDomainOptions = {
  logger: ILogger;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
  redis?: IRedisSource;
};
