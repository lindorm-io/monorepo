import { Logger } from "@lindorm-io/core-logger";
import { MemoryViewStore } from "./memory";
import { MongoViewStore } from "./mongo";
import { PostgresViewStore } from "./postgres";
import { View } from "../model";
import { ViewStoreType } from "../enum";
import { randomString } from "@lindorm-io/random";
import {
  IDomainViewStore,
  IMessage,
  IView,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreOptions,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../types";

export class ViewStore implements IDomainViewStore {
  private readonly logger: Logger;
  private readonly memory: IViewStore;
  private readonly mongo: IViewStore;
  private readonly postgres: IViewStore;

  public constructor(options: ViewStoreOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["ViewStore"]);

    this.memory = new MemoryViewStore();

    if (options.mongo) {
      this.mongo = new MongoViewStore(options.mongo, logger);
    }

    if (options.postgres) {
      this.postgres = new PostgresViewStore(options.postgres, logger);
    }
  }

  // public

  public async causationExists(
    identifier: ViewIdentifier,
    causation: IMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<boolean> {
    return await this.store(adapter).causationExists(identifier, causation);
  }

  public async clearProcessedCausationIds(
    view: IView,
    adapter: ViewEventHandlerAdapter,
  ): Promise<View> {
    const filter: ViewUpdateFilter = {
      id: view.id,
      name: view.name,
      context: view.context,
      hash: view.hash,
      revision: view.revision,
    };

    const data: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: view.revision + 1,
    };

    await this.store(adapter).clearProcessedCausationIds(filter, data, adapter);

    return new View({ ...view.toJSON(), ...data }, this.logger);
  }

  public async load(identifier: ViewIdentifier, adapter: ViewEventHandlerAdapter): Promise<View> {
    this.logger.debug("Loading view", { identifier });

    const existing = await this.store(adapter).find(identifier, adapter);

    if (existing) {
      this.logger.debug("Loading existing view", { existing });

      return new View(ViewStore.toData(existing), this.logger);
    }

    const view = new View(identifier, this.logger);

    this.logger.debug("Loading ephemeral view", { view: view.toJSON() });

    return view;
  }

  public async processCausationIds(view: IView, adapter: ViewEventHandlerAdapter): Promise<void> {
    const identifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    await this.store(adapter).insertProcessedCausationIds(identifier, view.processedCausationIds);
  }

  public async save(
    view: IView,
    causation: IMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<View> {
    this.logger.debug("Saving view", { view: view.toJSON(), causation });

    const identifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    const existing = await this.store(adapter).find(identifier, adapter);

    if (existing) {
      const included = existing.processed_causation_ids.includes(causation.id);

      if (included) {
        this.logger.debug("Found existing view matching causation", { existing });

        return new View(ViewStore.toData(existing), this.logger);
      }

      const causationExists = await this.store(adapter).causationExists(view, causation);

      if (causationExists) {
        this.logger.debug("Found existing view matching causation", { existing });

        return new View(ViewStore.toData(existing), this.logger);
      }
    }

    if (view.revision === 0) {
      const data: ViewData = {
        ...view.toJSON(),
        hash: randomString(16),
        processedCausationIds: [causation.id],
        revision: view.revision + 1,
      };

      await this.store(adapter).insert(ViewStore.toAttributes(data), adapter);

      return new View(data, this.logger);
    }

    const filter: ViewUpdateFilter = {
      id: view.id,
      name: view.name,
      context: view.context,
      hash: view.hash,
      revision: view.revision,
    };

    const data: ViewUpdateData = {
      destroyed: view.destroyed,
      hash: randomString(16),
      meta: view.meta,
      processed_causation_ids: [view.processedCausationIds, causation.id].flat(),
      revision: view.revision + 1,
      state: view.state,
    };

    await this.store(adapter).update(filter, data, adapter);

    return new View({ ...view.toJSON(), ...data }, this.logger);
  }

  // private

  private store(adapter: ViewEventHandlerAdapter): IViewStore {
    switch (adapter.type) {
      case ViewStoreType.CUSTOM:
        return adapter.custom;

      case ViewStoreType.MEMORY:
        return this.memory;

      case ViewStoreType.MONGO:
        return this.mongo;

      case ViewStoreType.POSTGRES:
        return this.postgres;

      default:
        throw new Error("Invalid store type");
    }
  }

  // private static

  private static toAttributes(data: ViewData): ViewStoreAttributes {
    return {
      id: data.id,
      name: data.name,
      context: data.context,
      destroyed: data.destroyed,
      hash: data.hash,
      meta: data.meta,
      processed_causation_ids: data.processedCausationIds,
      revision: data.revision,
      state: data.state,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private static toData(attributes: ViewStoreAttributes): ViewData {
    return {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      destroyed: attributes.destroyed,
      hash: attributes.hash,
      meta: attributes.meta,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }
}
