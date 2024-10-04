import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { Dict } from "@lindorm/types";
import { IViewStore } from "../../interfaces";
import { ViewIdentifier } from "../identifiers";

export type ViewStoreOptions = {
  custom?: IViewStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
  redis?: IRedisSource;
};

export type HermesViewStoreOptions = ViewStoreOptions & { logger: ILogger };

export type ViewUpdateFilter = ViewIdentifier & {
  revision: number;
};

export type ViewUpdateAttributes = {
  destroyed: boolean;
  meta: Dict;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Dict;
};
