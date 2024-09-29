import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IHermesMessage } from "../../interfaces";
import { ISagaStore } from "../../interfaces/SagaStore";
import { SagaIdentifier } from "../identifiers";

export type SagaStoreOptions = {
  custom?: ISagaStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesSagaStoreOptions = SagaStoreOptions & { logger: ILogger };

export type SagaUpdateFilter = SagaIdentifier & {
  hash: string;
  revision: number;
};

export type SagaUpdateData = {
  destroyed: boolean;
  hash: string;
  messages_to_dispatch: Array<IHermesMessage>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
};

export type SagaClearMessagesToDispatchData = {
  hash: string;
  messages_to_dispatch: Array<IHermesMessage>;
  revision: number;
};

export type SagaClearProcessedCausationIdsData = {
  hash: string;
  processed_causation_ids: Array<string>;
  revision: number;
};
