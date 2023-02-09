import { IN_MEMORY_SAGA_CAUSATION_STORE, IN_MEMORY_SAGA_STORE } from "./in-memory";
import {
  IMessage,
  ISagaStore,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

export class MemorySagaStore implements ISagaStore {
  public async causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean> {
    return !!IN_MEMORY_SAGA_CAUSATION_STORE.find(
      (x) =>
        x.id === identifier.id &&
        x.name === identifier.name &&
        x.context === identifier.context &&
        x.causation_id === causation.id,
    );
  }

  public async clearMessagesToDispatch(
    updateFilter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    const fn = (x: SagaStoreAttributes) =>
      x.id === updateFilter.id &&
      x.name === updateFilter.name &&
      x.context === updateFilter.context &&
      x.hash === updateFilter.hash &&
      x.revision === updateFilter.revision;

    const found = IN_MEMORY_SAGA_STORE.find(fn);
    const index = IN_MEMORY_SAGA_STORE.findIndex(fn);

    if (!found || index === -1) {
      throw new Error("Saga Store Item not found");
    }

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }

  public async clearProcessedCausationIds(
    updateFilter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    const fn = (x: SagaStoreAttributes) =>
      x.id === updateFilter.id &&
      x.name === updateFilter.name &&
      x.context === updateFilter.context &&
      x.hash === updateFilter.hash &&
      x.revision === updateFilter.revision;

    const found = IN_MEMORY_SAGA_STORE.find(fn);
    const index = IN_MEMORY_SAGA_STORE.findIndex(fn);

    if (!found || index === -1) {
      throw new Error("Saga Store Item not found");
    }

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }

  public async find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    return IN_MEMORY_SAGA_STORE.find(
      (x) =>
        x.id === identifier.id && x.name === identifier.name && x.context === identifier.context,
    );
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    const found = IN_MEMORY_SAGA_STORE.find(
      (x) =>
        x.id === attributes.id && x.name === attributes.name && x.context === attributes.context,
    );

    if (found) {
      throw new Error("Causation already exists");
    }

    IN_MEMORY_SAGA_STORE.push(attributes);
  }

  public async insertProcessedCausationIds(
    identifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    for (const causationId of causationIds) {
      IN_MEMORY_SAGA_CAUSATION_STORE.push({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      });
    }
  }

  public async update(updateFilter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    const fn = (x: SagaStoreAttributes) =>
      x.id === updateFilter.id &&
      x.name === updateFilter.name &&
      x.context === updateFilter.context &&
      x.hash === updateFilter.hash &&
      x.revision === updateFilter.revision;

    const found = IN_MEMORY_SAGA_STORE.find(fn);
    const index = IN_MEMORY_SAGA_STORE.findIndex(fn);

    if (!found || index === -1) {
      throw new Error("Saga Store Item not found");
    }

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }
}
