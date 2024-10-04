import {
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { ISaga } from "./Saga";

export interface IHermesSagaStore {
  clearMessages(saga: ISaga): Promise<ISaga>;
  load(sagaIdentifier: SagaIdentifier): Promise<ISaga>;
  loadCausations(sagaIdentifier: SagaIdentifier): Promise<Array<string>>;
  save(saga: ISaga, causation: IHermesMessage): Promise<ISaga>;
  saveCausations(saga: ISaga): Promise<ISaga>;
}

export interface ISagaStore {
  findCausationIds(sagaIdentifier: SagaIdentifier): Promise<Array<string>>;
  findSaga(sagaIdentifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined>;
  insertCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  insertSaga(attributes: SagaStoreAttributes): Promise<void>;
  updateSaga(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void>;
}
