import { find, findIndex } from "lodash";
import { viewStoreSingleton } from "./singleton/view-store-singleton";
import {
  IMessage,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreCausationAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MemoryViewStore implements IViewStore {
  public readonly causations: Array<ViewStoreCausationAttributes>;

  public constructor() {
    this.causations = [];
  }

  public async initialise(): Promise<void> {
    /* ignored */
  }

  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    return !!find(this.causations, {
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
    const found = find<ViewStoreAttributes>(viewStoreSingleton, updateFilter);
    const index = findIndex(viewStoreSingleton, updateFilter);

    viewStoreSingleton[index] = { ...found, ...data };
  }

  public async find(
    identifier: ViewIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined> {
    return find<ViewStoreAttributes>(viewStoreSingleton, identifier);
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    const found = find(viewStoreSingleton, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
    });

    if (found) {
      throw new Error("Causation already exists");
    }

    viewStoreSingleton.push(attributes);
  }

  public async insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    for (const causationId of causationIds) {
      this.causations.push({
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
    const found = find<ViewStoreAttributes>(viewStoreSingleton, updateFilter);
    const index = findIndex(viewStoreSingleton, updateFilter);

    viewStoreSingleton[index] = { ...found, ...data };
  }
}
