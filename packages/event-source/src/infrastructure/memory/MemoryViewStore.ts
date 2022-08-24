import { find, findIndex } from "lodash";
import { IN_MEMORY_VIEW_CAUSATION_STORE, IN_MEMORY_VIEW_STORE } from "./in-memory";
import {
  IMessage,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MemoryViewStore implements IViewStore {
  public async initialise(): Promise<void> {
    /* ignored */
  }

  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    return !!find(IN_MEMORY_VIEW_CAUSATION_STORE, {
      view_id: identifier.id,
      view_name: identifier.name,
      view_context: identifier.context,
      causation_id: causation.id,
    });
  }

  public async clearProcessedCausationIds(
    updateFilter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    const found = find<ViewStoreAttributes>(IN_MEMORY_VIEW_STORE, updateFilter);
    const index = findIndex(IN_MEMORY_VIEW_STORE, updateFilter);

    IN_MEMORY_VIEW_STORE[index] = { ...found, ...data };
  }

  public async find(
    identifier: ViewIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined> {
    return find<ViewStoreAttributes>(IN_MEMORY_VIEW_STORE, identifier);
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    const found = find(IN_MEMORY_VIEW_STORE, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
    });

    if (found) {
      throw new Error("Causation already exists");
    }

    IN_MEMORY_VIEW_STORE.push(attributes);
  }

  public async insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    for (const causationId of causationIds) {
      IN_MEMORY_VIEW_CAUSATION_STORE.push({
        view_id: identifier.id,
        view_name: identifier.name,
        view_context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      });
    }
  }

  public async update(
    updateFilter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    const found = find<ViewStoreAttributes>(IN_MEMORY_VIEW_STORE, updateFilter);
    const index = findIndex(IN_MEMORY_VIEW_STORE, updateFilter);

    IN_MEMORY_VIEW_STORE[index] = { ...found, ...data };
  }
}
