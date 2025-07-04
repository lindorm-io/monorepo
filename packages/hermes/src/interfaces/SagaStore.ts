import {
  SagaData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
  SagaUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { ISaga } from "./Saga";

export interface IHermesSagaStore {
  clearMessages(saga: ISaga): Promise<SagaData>;
  load(sagaIdentifier: SagaIdentifier): Promise<SagaData>;
  loadCausations(sagaIdentifier: SagaIdentifier): Promise<Array<string>>;
  save(saga: ISaga, causation: IHermesMessage): Promise<SagaData>;
  saveCausations(saga: ISaga): Promise<SagaData>;
}

export interface ISagaStore {
  findCausationIds(sagaIdentifier: SagaIdentifier): Promise<Array<string>>;
  findSaga(sagaIdentifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined>;
  insertCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  insertSaga(attributes: SagaStoreAttributes): Promise<void>;
  updateSaga(filter: SagaUpdateFilter, data: SagaUpdateAttributes): Promise<void>;
}
