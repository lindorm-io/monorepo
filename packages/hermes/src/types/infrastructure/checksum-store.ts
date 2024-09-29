import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IChecksumStore } from "../../interfaces";

export type ChecksumStoreOptions = {
  custom?: IChecksumStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesChecksumStoreOptions = ChecksumStoreOptions & { logger: ILogger };

export type ChecksumStoreFindFilter = {
  id: string;
  name: string;
  context: string;
  event_id: string;
};
