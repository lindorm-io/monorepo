import { find, findIndex } from "lodash";
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
    return !!find(IN_MEMORY_SAGA_CAUSATION_STORE, {
      saga_id: identifier.id,
      saga_name: identifier.name,
      saga_context: identifier.context,
      causation_id: causation.id,
    });
  }

  public async clearMessagesToDispatch(
    updateFilter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    const found = find<SagaStoreAttributes>(IN_MEMORY_SAGA_STORE, updateFilter);
    const index = findIndex(IN_MEMORY_SAGA_STORE, updateFilter);

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }

  public async clearProcessedCausationIds(
    updateFilter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    const found = find<SagaStoreAttributes>(IN_MEMORY_SAGA_STORE, updateFilter);
    const index = findIndex(IN_MEMORY_SAGA_STORE, updateFilter);

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }

  public async find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    return find<SagaStoreAttributes>(IN_MEMORY_SAGA_STORE, identifier);
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    const found = find(IN_MEMORY_SAGA_STORE, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
    });

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
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      });
    }
  }

  public async update(updateFilter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    const found = find<SagaStoreAttributes>(IN_MEMORY_SAGA_STORE, updateFilter);
    const index = findIndex(IN_MEMORY_SAGA_STORE, updateFilter);

    IN_MEMORY_SAGA_STORE[index] = { ...found, ...data };
  }
}
