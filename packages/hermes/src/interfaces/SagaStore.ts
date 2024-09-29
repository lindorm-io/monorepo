import {
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { ISaga } from "./Saga";

export interface IHermesSagaStore {
  causationExists(
    sagaIdentifier: SagaIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean>;
  clearMessagesToDispatch(saga: ISaga): Promise<ISaga>;
  clearProcessedCausationIds(saga: ISaga): Promise<ISaga>;
  load(sagaIdentifier: SagaIdentifier): Promise<ISaga>;
  processCausationIds(saga: ISaga): Promise<void>;
  save(saga: ISaga, causation: IHermesMessage): Promise<ISaga>;
}

export interface ISagaStore {
  causationExists(
    sagaIdentifier: SagaIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean>;
  clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void>;
  clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void>;
  find(sagaIdentifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined>;
  insert(attributes: SagaStoreAttributes): Promise<void>;
  insertProcessedCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void>;
}
