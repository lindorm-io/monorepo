import { IN_MEMORY_VIEW_CAUSATION_STORE, IN_MEMORY_VIEW_STORE } from "./in-memory";
import {
  IMessage,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MemoryViewStore implements IViewStore {
  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    return !!IN_MEMORY_VIEW_CAUSATION_STORE.find(
      (x) =>
        x.id === identifier.id &&
        x.name === identifier.name &&
        x.context === identifier.context &&
        x.causation_id === causation.id,
    );
  }

  public async clearProcessedCausationIds(
    updateFilter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    const fn = (x: ViewStoreAttributes) =>
      x.id === updateFilter.id &&
      x.name === updateFilter.name &&
      x.context === updateFilter.context &&
      x.hash === updateFilter.hash &&
      x.revision === updateFilter.revision;

    const found = IN_MEMORY_VIEW_STORE.find(fn);
    const index = IN_MEMORY_VIEW_STORE.findIndex(fn);

    if (!found || index === -1) {
      throw new Error("View Store Item not found");
    }

    IN_MEMORY_VIEW_STORE[index] = { ...found, ...data };
  }

  public async find(
    identifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined> {
    return IN_MEMORY_VIEW_STORE.find(
      (x) =>
        x.id === identifier.id && x.name === identifier.name && x.context === identifier.context,
    );
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    const found = IN_MEMORY_VIEW_STORE.find(
      (x) =>
        x.id === attributes.id && x.name === attributes.name && x.context === attributes.context,
    );

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
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      });
    }
  }

  public async update(
    updateFilter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    const fn = (x: ViewStoreAttributes) =>
      x.id === updateFilter.id &&
      x.name === updateFilter.name &&
      x.context === updateFilter.context &&
      x.hash === updateFilter.hash &&
      x.revision === updateFilter.revision;

    const found = IN_MEMORY_VIEW_STORE.find(fn);
    const index = IN_MEMORY_VIEW_STORE.findIndex(fn);

    if (!found || index === -1) {
      throw new Error("View Store Item not found");
    }

    IN_MEMORY_VIEW_STORE[index] = { ...found, ...data };
  }
}
