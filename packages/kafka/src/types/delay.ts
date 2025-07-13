import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { Database } from "better-sqlite3";
import { IKafkaDelayEnvelope, IKafkaDelayStore } from "../interfaces";

export type KafkaDelayOptions = Omit<IKafkaDelayEnvelope, "id" | "timestamp"> & {
  delay: number;
};

export type KafkaDelayPollCallback = (envelope: IKafkaDelayEnvelope) => Promise<void>;

export type KafkaDelayServiceOptions = {
  custom?: IKafkaDelayStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
  redis?: IRedisSource;
  sqlite?: Database;
  logger: ILogger;
};
