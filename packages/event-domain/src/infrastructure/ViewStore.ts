import { Collection, Filter, FindOptions, UpdateFilter } from "mongodb";
import { DomainEvent } from "../message";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../error";
import { View } from "../entity";
import { flatten, snakeCase } from "lodash";
import {
  HandlerIdentifier,
  IViewStore,
  State,
  StoreBaseIndex,
  ViewData,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreCollectionOptions,
  ViewStoreDocumentOptions,
  ViewStoreOptions,
  ViewStoreQueryOptions,
} from "../types";

export class ViewStore implements IViewStore {
  private readonly connection: MongoConnection;
  private readonly databaseName: string;
  private readonly indices: Array<StoreBaseIndex>;
  private readonly logger: Logger;

  public constructor(options: ViewStoreOptions) {
    this.connection = options.connection;
    this.databaseName = options.database;
    this.logger = options.logger.createChildLogger(["ViewStore"]);

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
          causationList: 1,
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
    view: View,
    causation: DomainEvent,
    documentOptions: ViewStoreDocumentOptions,
  ): Promise<View> {
    const start = Date.now();
    const json = view.toJSON();

    this.logger.debug("Saving View", {
      view: json,
      causation,
      documentOptions,
    });

    const collection = await this.collection({
      ...documentOptions,
      collection: documentOptions.collection || ViewStore.getCollectionName(json),
    });

    const existing = await this.find(
      collection,
      {
        id: view.id,
        name: view.name,
        context: view.context,
      },
      {
        causationList: { $in: [causation.id] },
      },
    );

    if (existing) {
      this.logger.debug("Returning existing View without change", {
        view: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    if (view.revision === 0) {
      this.logger.debug("Inserting new View", {
        view: json,
        time: Date.now() - start,
      });

      return await this.insert(collection, view, causation);
    }

    this.logger.debug("Updating existing View", {
      view: json,
      time: Date.now() - start,
    });

    return await this.update(collection, view, causation);
  }

  public async load(
    viewIdentifier: ViewIdentifier,
    documentOptions: ViewStoreDocumentOptions,
  ): Promise<View> {
    const start = Date.now();

    this.logger.debug("Loading View", { viewIdentifier, documentOptions });

    const collection = await this.collection({
      ...documentOptions,
      collection: documentOptions.collection || ViewStore.getCollectionName(viewIdentifier),
    });

    const existing = await this.find(collection, viewIdentifier);

    if (existing) {
      this.logger.debug("Returning existing View", {
        view: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    const view = new View(viewIdentifier, this.logger);

    this.logger.debug("Returning ephemeral View", {
      view: view.toJSON(),
      time: Date.now() - start,
    });

    return view;
  }

  public async query<S extends State = State>(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Array<ViewStoreAttributes<S>>> {
    const start = Date.now();

    this.logger.debug("Querying ViewStore", {
      filter,
      findOptions,
      queryOptions,
    });

    const collection = await this.collection(queryOptions);
    const cursor = await collection.find(filter, findOptions);
    const docs = await cursor.toArray();

    this.logger.verbose("Query successful", {
      amount: docs.length,
      time: Date.now() - start,
    });

    return docs as Array<ViewStoreAttributes<S>>;
  }

  public async listCollections(): Promise<Array<string>> {
    const database = this.databaseName || this.connection.database;
    const cursor = await this.connection.client.db(database).listCollections();
    const collections = await cursor.toArray();

    return collections.map((item) => item.name).filter((name) => name.startsWith("views_"));
  }

  public async renameCollection(collection: string, name: string): Promise<void> {
    const database = this.databaseName || this.connection.database;

    await this.connection.client.db(database).renameCollection(collection, name);
  }

  public async dropCollection(collection: string): Promise<void> {
    const database = this.databaseName || this.connection.database;

    await this.connection.client.db(database).dropCollection(collection);
  }

  // private

  private async collection(
    options: ViewStoreCollectionOptions,
  ): Promise<Collection<ViewStoreAttributes>> {
    const start = Date.now();

    const database = options.database || this.databaseName || this.connection.database;
    const indices = flatten([this.indices, options.indices || []]);

    this.logger.debug("Establishing collection", {
      database,
      collection: options.collection,
      indices,
    });

    if (!database) {
      throw new LindormError("Invalid connection properties", {
        description: "Database name is missing",
      });
    }

    if (!options.collection) {
      throw new LindormError("Invalid connection properties", {
        description: "Collection name is missing",
      });
    }

    await this.connection.connect();

    const collection = this.connection.client
      .db(database)
      .collection<ViewStoreAttributes>(options.collection);

    for (const { indexSpecification, createIndexesOptions } of indices) {
      await collection.createIndex(indexSpecification, createIndexesOptions);
    }

    this.logger.debug("Returning collection", {
      time: Date.now() - start,
    });

    return collection;
  }

  private async find(
    collection: Collection<ViewStoreAttributes>,
    viewIdentifier: ViewIdentifier,
    findFilter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<View | undefined> {
    const start = Date.now();

    const filter = { ...viewIdentifier, ...findFilter };
    const projection: Record<keyof ViewData, number> = {
      id: 1,
      name: 1,
      context: 1,
      causationList: 1,
      destroyed: 1,
      meta: 1,
      revision: 1,
      state: 1,
    };
    const options = {
      ...findOptions,
      projection: findOptions.projection || projection,
    };

    this.logger.debug("Finding View document", {
      filter,
      options,
    });

    try {
      const result = await collection.findOne(filter, options);

      if (result) {
        const view = new View(result, this.logger);

        this.logger.debug("Returning existing View document", {
          result,
          view: view.toJSON(),
          time: Date.now() - start,
        });

        return view;
      }

      this.logger.debug("Found no existing View document", {
        time: Date.now() - start,
      });
    } catch (err) {
      this.logger.error("Failed to find View document", err);

      throw err;
    }
  }

  private async insert(
    collection: Collection<ViewStoreAttributes>,
    view: View,
    causation: DomainEvent,
  ): Promise<View> {
    const start = Date.now();

    const causationList = [causation.id];
    const revision = view.revision + 1;
    const viewData: ViewData = {
      id: view.id,
      name: view.name,
      context: view.context,

      causationList,
      destroyed: view.destroyed,
      meta: view.meta,
      revision,
      state: view.state,
    };
    const doc: ViewStoreAttributes = {
      ...viewData,
      timeModified: new Date(),
      timestamp: new Date(),
    };

    this.logger.debug("Inserting View document", { doc });

    try {
      const result = await collection.insertOne(doc);

      this.logger.debug("Inserted View document", {
        result,
        time: Date.now() - start,
      });

      return new View(viewData, this.logger);
    } catch (err) {
      this.logger.error("Failed to insert View document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async update(
    collection: Collection<ViewStoreAttributes>,
    view: View,
    causation: DomainEvent,
  ): Promise<View> {
    const start = Date.now();

    const filter: Filter<ViewStoreAttributes> = {
      id: view.id,
      name: view.name,
      context: view.context,
      revision: view.revision,
    };
    const revision = view.revision + 1;
    const update: UpdateFilter<ViewStoreAttributes> = {
      $set: {
        destroyed: view.destroyed,
        meta: view.meta,
        revision,
        state: view.state,
        timeModified: new Date(),
      },
      $push: {
        causationList: causation.id as never,
      },
    };

    this.logger.debug("Updating View document", {
      filter,
      update,
    });

    try {
      const result = await collection.findOneAndUpdate(filter, update);

      if (!result.ok) {
        throw new MongoNotUpdatedError(filter, update);
      }

      this.logger.debug("Updated View document", {
        result,
        time: Date.now() - start,
      });

      return new View(
        {
          id: view.id,
          name: view.name,
          context: view.context,

          causationList: flatten([view.causationList, causation.id]),
          destroyed: view.destroyed,
          meta: view.meta,
          revision,
          state: view.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to update View document", err);

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
