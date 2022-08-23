import { find, findIndex } from "lodash";
import {
  IMessage,
  ISagaStore,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaStoreCausationAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

export class MemorySagaStore implements ISagaStore {
  public readonly causations: Array<SagaStoreCausationAttributes>;
  public readonly sagas: Array<SagaStoreAttributes>;

  public constructor() {
    this.causations = [];
    this.sagas = [];
  }

  public async initialise(): Promise<void> {
    /* ignored */
  }

  public async causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean> {
    return !!find(this.causations, {
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
    const found = find<SagaStoreAttributes>(this.sagas, updateFilter);
    const index = findIndex(this.sagas, updateFilter);

    this.sagas[index] = { ...found, ...data };
  }

  public async clearProcessedCausationIds(
    updateFilter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    const found = find<SagaStoreAttributes>(this.sagas, updateFilter);
    const index = findIndex(this.sagas, updateFilter);

    this.sagas[index] = { ...found, ...data };
  }

  public async find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    return find<SagaStoreAttributes>(this.sagas, identifier);
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    const found = find(this.sagas, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
    });

    if (found) {
      throw new Error("Causation already exists");
    }

    this.sagas.push(attributes);
  }

  public async insertProcessedCausationIds(
    identifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    for (const causationId of causationIds) {
      this.causations.push({
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      });
    }
  }

  public async update(updateFilter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    const found = find<SagaStoreAttributes>(this.sagas, updateFilter);
    const index = findIndex(this.sagas, updateFilter);

    this.sagas[index] = { ...found, ...data };
  }
}
