import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { Dict } from "@lindorm/types";
import { ViewIdentifier } from "../identifiers";

export type ViewStoreOptions = {
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
  redis?: IRedisSource;
};

export type HermesViewStoreOptions = ViewStoreOptions & { logger: ILogger };

export type ViewUpdateFilter = ViewIdentifier & {
  hash: string;
  revision: number;
};

export type ViewUpdateData = {
  destroyed: boolean;
  hash: string;
  meta: Dict;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Dict;
};

export type ViewClearProcessedCausationIdsData = {
  hash: string;
  processed_causation_ids: Array<string>;
  revision: number;
};
