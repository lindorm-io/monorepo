import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IHermesMessage, ISagaStore } from "../../interfaces";
import { SagaIdentifier } from "../identifiers";

export type SagaStoreOptions = {
  custom?: ISagaStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesSagaStoreOptions = SagaStoreOptions & { logger: ILogger };

export type SagaUpdateFilter = SagaIdentifier & {
  revision: number;
};

export type SagaUpdateAttributes = {
  destroyed: boolean;
  messages_to_dispatch: Array<IHermesMessage>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
};
