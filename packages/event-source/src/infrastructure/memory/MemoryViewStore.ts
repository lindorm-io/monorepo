import { find, findIndex } from "lodash";
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
  public readonly views: Array<ViewStoreAttributes>;

  public constructor() {
    this.causations = [];
    this.views = [];
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
    const found = find<ViewStoreAttributes>(this.views, updateFilter);
    const index = findIndex(this.views, updateFilter);

    this.views[index] = { ...found, ...data };
  }

  public async find(
    identifier: ViewIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined> {
    return find<ViewStoreAttributes>(this.views, identifier);
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    const found = find(this.views, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
    });

    if (found) {
      throw new Error("Causation already exists");
    }

    this.views.push(attributes);
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
    const found = find<ViewStoreAttributes>(this.views, updateFilter);
    const index = findIndex(this.views, updateFilter);

    this.views[index] = { ...found, ...data };
  }
}
