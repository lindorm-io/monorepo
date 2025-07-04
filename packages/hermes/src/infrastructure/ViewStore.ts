import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ViewStoreType } from "../enums";
import { IHermesMessage, IHermesViewStore, IView, IViewStore } from "../interfaces";
import {
  HermesViewStoreOptions,
  ViewData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../types";
import { MongoViewStore } from "./mongo";
import { PostgresViewStore } from "./postgres";
import { RedisViewStore } from "./redis";

export class ViewStore implements IHermesViewStore {
  private readonly logger: ILogger;
  private readonly custom: IViewStore | undefined;
  private readonly mongo: IViewStore | undefined;
  private readonly postgres: IViewStore | undefined;
  private readonly redis: IViewStore | undefined;

  public constructor(options: HermesViewStoreOptions) {
    this.logger = options.logger.child(["ViewStore"]);

    if (options.custom) {
      this.custom = options.custom;
    }
    if (options.mongo?.name === "MongoSource") {
      this.mongo = new MongoViewStore(options.mongo, this.logger);
    }
    if (options.postgres?.name === "PostgresSource") {
      this.postgres = new PostgresViewStore(options.postgres, this.logger);
    }
    if (options.redis?.name === "RedisSource") {
      this.redis = new RedisViewStore(options.redis, this.logger);
    }
  }

  // public

  public async load(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewData> {
    this.logger.debug("Loading view", { viewIdentifier });

    const existing = await this.store(adapter).findView({
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
    });

    if (existing) {
      this.logger.debug("Loading existing view", { existing });

      return ViewStore.toData(existing);
    }

    const view: ViewData = {
      ...viewIdentifier,
      destroyed: false,
      meta: {},
      processedCausationIds: [],
      revision: 0,
      state: {},
    };

    this.logger.debug("Loading ephemeral view", { view });

    return view;
  }

  public async loadCausations(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<Array<string>> {
    return await this.store(adapter).findCausationIds(viewIdentifier);
  }

  public async save(
    view: IView,
    causation: IHermesMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewData> {
    this.logger.debug("Saving view", { view: view.toJSON(), causation });

    const viewIdentifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    const existing = await this.store(adapter).findView(viewIdentifier);

    if (existing) {
      if (existing.processed_causation_ids.includes(causation.id)) {
        this.logger.debug("Found existing view matching causation", { existing });

        return ViewStore.toData(existing);
      }

      const causations = await this.store(adapter).findCausationIds(viewIdentifier);

      if (causations.includes(causation.id)) {
        this.logger.debug("Found existing view matching causation", { existing });

        return ViewStore.toData(existing);
      }
    }

    if (view.revision === 0) {
      const data: ViewData = {
        ...view.toJSON(),
        processedCausationIds: [causation.id],
        revision: view.revision + 1,
      };

      await this.store(adapter).insertView(ViewStore.toAttributes(data));

      return data;
    }

    const filter: ViewUpdateFilter = {
      id: view.id,
      name: view.name,
      context: view.context,
      revision: view.revision,
    };

    const attributes: ViewUpdateAttributes = {
      destroyed: view.destroyed,
      meta: view.meta,
      processed_causation_ids: [view.processedCausationIds, causation.id].flat(),
      revision: view.revision + 1,
      state: view.state,
    };

    await this.store(adapter).updateView(filter, attributes);

    return {
      ...view.toJSON(),
      destroyed: attributes.destroyed,
      meta: attributes.meta,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }

  public async saveCausations(
    view: IView,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewData> {
    this.logger.debug("Saving causations", { view: view.toJSON() });

    if (!view.processedCausationIds.length) {
      this.logger.debug("No causations to save", { view: view.toJSON() });
      return view;
    }

    const viewIdentifier: ViewIdentifier = {
      id: view.id,
      name: view.name,
      context: view.context,
    };

    const causations = await this.store(adapter).findCausationIds(viewIdentifier);
    const insert = view.processedCausationIds.filter((id) => !causations.includes(id));

    if (insert.length) {
      this.logger.debug("Inserting causations", { insert });
      await this.store(adapter).insertCausationIds(viewIdentifier, insert);
    }

    const filter: ViewUpdateFilter = {
      id: view.id,
      name: view.name,
      context: view.context,
      revision: view.revision,
    };

    const attributes: ViewUpdateAttributes = {
      destroyed: view.destroyed,
      meta: view.meta,
      processed_causation_ids: [],
      revision: view.revision + 1,
      state: view.state,
    };

    await this.store(adapter).updateView(filter, attributes);

    return {
      ...view.toJSON(),
      destroyed: attributes.destroyed,
      meta: attributes.meta,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }

  // private

  private store(adapter: ViewEventHandlerAdapter): IViewStore {
    switch (adapter.type) {
      case ViewStoreType.Custom:
        if (!this.custom) {
          this.logger.error("Custom ViewStore not provided");
          throw new LindormError("Custom ViewStore not provided");
        }
        return this.custom;

      case ViewStoreType.Mongo:
        if (!this.mongo) {
          this.logger.error("Custom ViewStore not provided");
          throw new LindormError("Mongo connection not provided");
        }
        return this.mongo;

      case ViewStoreType.Postgres:
        if (!this.postgres) {
          this.logger.error("Custom ViewStore not provided");
          throw new LindormError("Postgres connection not provided");
        }
        return this.postgres;

      case ViewStoreType.Redis:
        if (!this.redis) {
          this.logger.error("Custom ViewStore not provided");
          throw new LindormError("Redis connection not provided");
        }
        return this.redis;

      default:
        throw new LindormError("Invalid store type");
    }
  }

  // private static

  private static toAttributes(data: ViewData): ViewStoreAttributes {
    return {
      id: data.id,
      name: data.name,
      context: data.context,
      destroyed: data.destroyed,
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
      meta: attributes.meta,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }
}
