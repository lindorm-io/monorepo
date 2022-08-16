import { Collection, Filter, FindOptions } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../../error";
import { View } from "../../model";
import { flatten, snakeCase } from "lodash";
import {
  HandlerIdentifier,
  IMessage,
  IView,
  IViewStore,
  MongoIndex,
  MongoViewStoreAttributes,
  MongoViewStoreCollectionOptions,
  ViewData,
  ViewIdentifier,
  ViewStoreHandlerOptions,
} from "../../types";

export class MongoViewStore implements IViewStore {
  private readonly connection: IMongoConnection;
  private readonly indices: Array<MongoIndex>;
  private readonly logger: ILogger;

  public constructor(connection: IMongoConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["ViewStore"]);

    this.indices = [
      {
        indexSpecification: {
          id: 1,
          name: 1,
          context: 1,
        },
        createIndexesOptions: {
          name: "unique_path",
          unique: true,
        },
      },
      {
        indexSpecification: {
          id: 1,
          name: 1,
          context: 1,
          causation_list: 1,
        },
        createIndexesOptions: {
          name: "unique_causation",
          unique: true,
        },
      },
      {
        indexSpecification: {
          id: 1,
          name: 1,
          context: 1,
          destroyed: 1,
        },
        createIndexesOptions: {
          name: "unique_destroyed",
          unique: true,
        },
      },
      {
        indexSpecification: {
          id: 1,
          name: 1,
          context: 1,
          revision: 1,
        },
        createIndexesOptions: {
          name: "unique_revision",
          unique: true,
        },
      },
    ];
  }

  public async save(
    view: IView,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    const json = view.toJSON();

    this.logger.debug("Saving view", {
      view: json,
      causation,
      handlerOptions,
    });

    const collection = await this.collection({
      collection: handlerOptions.mongo?.collection,
      indices: handlerOptions.mongo?.indices,
      view,
    });

    const existing = await this.find(
      collection,
      {
        id: json.id,
        name: json.name,
        context: json.context,
      },
      {
        causation_list: { $in: [causation.id] },
      },
    );

    if (existing) {
      this.logger.debug("Found existing view matching causation", { view: existing.toJSON() });

      return existing;
    }

    if (json.revision === 0) {
      return await this.insert(collection, json, causation, handlerOptions);
    }

    return await this.update(collection, json, causation, handlerOptions);
  }

  public async load(
    identifier: ViewIdentifier,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    this.logger.debug("Loading view", { identifier, handlerOptions });

    const collection = await this.collection({
      collection: handlerOptions.mongo?.collection,
      view: identifier,
    });

    const existing = await this.find(collection, identifier);

    if (existing) {
      this.logger.debug("Loading existing view", { view: existing.toJSON() });

      return existing;
    }

    const view = new View(identifier, this.logger);

    this.logger.debug("Loading ephemeral view", { view: view.toJSON() });

    return view;
  }

  // private

  private async collection(
    options: MongoViewStoreCollectionOptions,
  ): Promise<Collection<MongoViewStoreAttributes>> {
    const start = Date.now();

    const collectionName = options.collection || MongoViewStore.getCollectionName(options.view);
    const indices = flatten([this.indices, options.indices || []]);

    this.logger.debug("Establishing collection", {
      collection: options.collection,
      indices,
    });

    await this.connection.connect();

    const collection =
      this.connection.database.collection<MongoViewStoreAttributes>(collectionName);

    for (const { indexSpecification, createIndexesOptions } of indices) {
      await collection.createIndex(indexSpecification, createIndexesOptions);
    }

    this.logger.debug("Returning collection", {
      time: Date.now() - start,
    });

    return collection;
  }

  private async find(
    collection: Collection<MongoViewStoreAttributes>,
    identifier: ViewIdentifier,
    findFilter: Filter<MongoViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<View | undefined> {
    const filter = { ...identifier, ...findFilter };
    const projection: Partial<Record<keyof MongoViewStoreAttributes, number>> = {
      id: 1,
      name: 1,
      context: 1,
      causation_list: 1,
      destroyed: 1,
      meta: 1,
      revision: 1,
      state: 1,
    };
    const options = {
      ...findOptions,
      projection: findOptions.projection || projection,
    };

    this.logger.debug("Finding view", {
      filter,
      options,
    });

    try {
      const result = await collection.findOne(filter, options);

      if (!result) {
        this.logger.debug("View not found");
        return;
      }

      this.logger.debug("Found view document", { result });

      return new View(
        {
          id: result.id,
          name: result.name,
          context: result.context,
          causationList: result.causation_list,
          destroyed: result.destroyed,
          meta: result.meta,
          revision: result.revision,
          state: result.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  private async insert(
    collection: Collection<MongoViewStoreAttributes>,
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    this.logger.debug("Inserting view", {
      view,
      causation,
      handlerOptions,
    });

    try {
      const result = await collection.insertOne({
        id: view.id,
        name: view.name,
        context: view.context,
        causation_list: [causation.id],
        destroyed: view.destroyed,
        meta: view.meta,
        revision: view.revision + 1,
        state: view.state,
        created_at: new Date(),
        updated_at: new Date(),
      });

      this.logger.debug("Saved view", { view: result });

      return new View(
        {
          ...view,
          causationList: [causation.id],
          revision: view.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to insert view", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async update(
    collection: Collection<MongoViewStoreAttributes>,
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    this.logger.debug("Updating view", {
      view,
      causation,
      handlerOptions,
    });

    try {
      const result = await collection.findOneAndUpdate(
        {
          id: view.id,
          name: view.name,
          context: view.context,
          revision: view.revision,
        },
        {
          $set: {
            destroyed: view.destroyed,
            meta: view.meta,
            revision: view.revision + 1,
            state: view.state,
            updated_at: new Date(),
          },
          $push: {
            causation_list: (handlerOptions.mongo?.causationsCap &&
            handlerOptions.mongo?.causationsCap > 0
              ? { $each: [causation.id], $slice: handlerOptions.mongo.causationsCap * -1 }
              : causation.id) as never,
          },
        },
      );

      if (!result.ok) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Updated view document", { result });

      return new View(
        {
          ...view,
          causationList:
            handlerOptions.mongo?.causationsCap && handlerOptions.mongo?.causationsCap > 0
              ? [...view.causationList, causation.id].slice(handlerOptions.mongo.causationsCap * -1)
              : [...view.causationList, causation.id],
          revision: view.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to update view", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  // public static

  public static getCollectionName(identifier: HandlerIdentifier): string {
    return `views_${snakeCase(identifier.context)}_${snakeCase(identifier.name)}`;
  }
}
