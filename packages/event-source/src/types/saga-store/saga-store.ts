import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { ISaga, SagaIdentifier } from "../entity";
import { Saga } from "../../entity";
import { SagaStoreAttributes } from "./saga-store-attributes";

export type SagaStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export interface SagaStoreOptions {
  custom?: ISagaStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: SagaStoreAdapterType;
}

export interface SagaUpdateFilter extends SagaIdentifier {
  hash: string;
  revision: number;
}

export interface SagaUpdateData {
  destroyed: boolean;
  hash: string;
  messages_to_dispatch: Array<IMessage>;
  processed_causation_ids: Array<string>;
  revision: number;
  state: Record<string, any>;
}

export interface SagaClearMessagesToDispatchData {
  hash: string;
  messages_to_dispatch: Array<IMessage>;
  revision: number;
}

export interface SagaClearProcessedCausationIdsData {
  hash: string;
  processed_causation_ids: Array<string>;
  revision: number;
}

export interface IDomainSagaStore {
  causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean>;
  clearMessagesToDispatch(saga: ISaga): Promise<Saga>;
  clearProcessedCausationIds(saga: ISaga): Promise<Saga>;
  load(identifier: SagaIdentifier): Promise<Saga>;
  processCausationIds(saga: ISaga): Promise<void>;
  save(saga: ISaga, causation: IMessage): Promise<Saga>;
}

export interface ISagaStore {
  causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean>;
  clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void>;
  clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void>;
  find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined>;
  insert(attributes: SagaStoreAttributes): Promise<void>;
  insertProcessedCausationIds(
    identifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void>;
}
