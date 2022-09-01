import { Collection } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoNotUpdatedError } from "../../error";
import { find, flatten } from "lodash";
import { getViewStoreIndexes, VIEW_CAUSATION, VIEW_CAUSATION_INDEXES } from "../../constant";
import { getViewStoreName } from "../../util";
import {
  HandlerIdentifier,
  IMessage,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerStoreOptions,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewCausationAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MongoViewStore extends MongoBase implements IViewStore {
  private readonly initialisedViews: Array<HandlerIdentifier>;
  private promise: () => Promise<void>;

  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(connection, logger);

    this.initialisedViews = [];
    this.promise = this.initialiseCausation;
  }

  // public

  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const result = await collection.findOne({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        causation_id: causation.id,
      });

      return !!result;
    } catch (err) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    await this.initialise(filter, options);

    try {
      const collection = await this.viewCollection(filter, options);

      const result = await collection.updateOne(
        {
          id: filter.id,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          $set: {
            hash: data.hash,
            processed_causation_ids: data.processed_causation_ids,
            revision: data.revision,
            updated_at: new Date(),
          },
        },
      );

      if (!result.acknowledged) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Cleared processed causation ids", { result });
    } catch (err) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(
    identifier: ViewIdentifier,
    options: ViewEventHandlerStoreOptions,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { identifier });

    await this.initialise(identifier, options);

    try {
      const collection = await this.viewCollection(identifier, options);

      const result = await collection.findOne({ id: identifier.id });

      if (!result) {
        this.logger.debug("View not found");

        return;
      }

      this.logger.debug("Found view", { result });

      return result;
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async insert(
    attributes: ViewStoreAttributes,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    await this.initialise(attributes, options);

    try {
      const collection = await this.viewCollection(
        {
          name: attributes.name,
          context: attributes.context,
        },
        options,
      );

      const result = await collection.insertOne(attributes);

      this.logger.debug("Inserted view", { result });
    } catch (err) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    identifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { identifier, causationIds });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const documents: Array<ViewCausationAttributes> = causationIds.map((causationId) => ({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      }));

      const result = await collection.insertMany(documents);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    await this.initialise(filter, options);

    try {
      const collection = await this.viewCollection(filter, options);

      const result = await collection.updateOne(
        {
          id: filter.id,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          $set: {
            destroyed: data.destroyed,
            hash: data.hash,
            meta: data.meta,
            processed_causation_ids: data.processed_causation_ids,
            revision: data.revision,
            state: data.state,
            updated_at: new Date(),
          },
        },
      );

      if (!result.acknowledged) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Updated view", { result });
    } catch (err) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }

  // private

  private async initialise(
    view: HandlerIdentifier,
    options: ViewEventHandlerStoreOptions,
  ): Promise<void> {
    await this.promise();

    if (find(this.initialisedViews, view)) return;

    const storeName = getViewStoreName(view);
    const custom = options.indexes || [];
    const indexes = flatten([getViewStoreIndexes(view), custom]);

    await this.createIndexes(storeName, indexes);

    this.initialisedViews.push(view);
  }

  private async initialiseCausation(): Promise<void> {
    await this.createIndexes(VIEW_CAUSATION, VIEW_CAUSATION_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async viewCollection(
    view: HandlerIdentifier,
    options: ViewEventHandlerStoreOptions,
  ): Promise<Collection<ViewStoreAttributes>> {
    const storeName = getViewStoreName(view);
    await this.createIndexes(storeName, getViewStoreIndexes(view));

    return this.connection.database.collection(storeName);
  }

  private async causationCollection(): Promise<Collection<ViewCausationAttributes>> {
    return this.connection.database.collection(VIEW_CAUSATION);
  }
}
