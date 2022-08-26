import { ILogger } from "@lindorm-io/winston";
import { MemoryViewStore } from "./memory";
import { MongoViewStore } from "./mongo";
import { PostgresViewStore } from "./postgres";
import { View } from "../model";
import { ViewStoreType } from "../enum";
import { flatten } from "lodash";
import { randomString } from "@lindorm-io/core";
import {
  IDomainViewStore,
  IMessage,
  IView,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewData,
  ViewEventHandlerAdapters,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreOptions,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../types";

export class ViewStore implements IDomainViewStore {
  private readonly store: IViewStore;
  private readonly logger: ILogger;

  public constructor(options: ViewStoreOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["ViewStore"]);

    switch (options.type) {
      case ViewStoreType.CUSTOM:
        if (!options.custom) throw new Error("Connection not provided");
        this.store = options.custom;
        break;

      case ViewStoreType.MEMORY:
        this.store = new MemoryViewStore();
        break;

      case ViewStoreType.MONGO:
        if (!options.mongo) throw new Error("Connection not provided");
        this.store = new MongoViewStore(options.mongo, logger);
        break;

      case ViewStoreType.POSTGRES:
        if (!options.postgres) throw new Error("Connection not provided");
        this.store = new PostgresViewStore(options.postgres, logger);
        break;

      default:
        throw new Error("Invalid ViewStore type");
    }
  }

  // public

  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    return await this.store.causationExists(identifier, causation);
  }

  public async clearProcessedCausationIds(
    view: IView,
    adapters: ViewEventHandlerAdapters,
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

    await this.store.clearProcessedCausationIds(filter, data, adapters);

    return new View({ ...view.toJSON(), ...data }, this.logger);
  }

  public async load(identifier: ViewIdentifier, adapters: ViewEventHandlerAdapters): Promise<View> {
    this.logger.debug("Loading view", { identifier });

    const existing = await this.store.find(identifier, adapters);

    if (existing) {
      this.logger.debug("Loading existing view", { existing });

      return new View(ViewStore.toData(existing), this.logger);
    }

    const view = new View(identifier, this.logger);

    this.logger.debug("Loading ephemeral view", { view: view.toJSON() });

    return view;
  }

  public async processCausationIds(view: IView): Promise<void> {
    const identifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    await this.store.insertProcessedCausationIds(identifier, view.processedCausationIds);
  }

  public async save(
    view: IView,
    causation: IMessage,
    adapters: ViewEventHandlerAdapters,
  ): Promise<View> {
    this.logger.debug("Saving view", { view: view.toJSON(), causation });

    const identifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    const existing = await this.store.find(identifier, adapters);

    if (existing) {
      const included = existing.processed_causation_ids.includes(causation.id);

      if (included) {
        this.logger.debug("Found existing view matching causation", { existing });

        return new View(ViewStore.toData(existing), this.logger);
      }

      const causationExists = await this.store.causationExists(view, causation);

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

      await this.store.insert(ViewStore.toAttributes(data), adapters);

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
      modified: view.modified,
      processed_causation_ids: flatten([view.processedCausationIds, causation.id]),
      revision: view.revision + 1,
      state: view.state,
    };

    await this.store.update(filter, data, adapters);

    return new View({ ...view.toJSON(), ...data }, this.logger);
  }

  // private

  private static toAttributes(data: ViewData): ViewStoreAttributes {
    return {
      id: data.id,
      name: data.name,
      context: data.context,
      destroyed: data.destroyed,
      hash: data.hash,
      modified: data.modified,
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
      modified: attributes.modified,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }
}
