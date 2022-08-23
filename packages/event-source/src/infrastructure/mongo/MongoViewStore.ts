import { Collection } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoNotUpdatedError } from "../../error";
import { snakeCase } from "lodash";
import {
  VIEW_CAUSATION_COLLECTION,
  VIEW_CAUSATION_COLLECTION_INDICES,
  VIEW_COLLECTION_INDICES,
} from "../../constant";
import {
  HandlerIdentifier,
  IMessage,
  IViewStore,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreCausationAttributes,
  ViewStoreInitialiseData,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MongoViewStore extends MongoBase implements IViewStore {
  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

  public async initialise(data: Array<ViewStoreInitialiseData>): Promise<void> {
    await this.createIndices(VIEW_CAUSATION_COLLECTION, VIEW_CAUSATION_COLLECTION_INDICES);

    for (const item of data) {
      await this.createIndices(MongoViewStore.getCollectionName(item.view, item.collection), [
        ...VIEW_COLLECTION_INDICES,
        ...(item.indices || []),
      ]);
    }
  }

  public async causationExists(identifier: ViewIdentifier, causation: IMessage): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    try {
      const collection = await this.causationCollection();

      const result = await collection.findOne({
        view_id: identifier.id,
        view_name: identifier.name,
        view_context: identifier.context,
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
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      const collection = await this.viewCollection(filter, adapters);

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
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { identifier });

    try {
      const collection = await this.viewCollection(identifier, adapters);

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
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      const collection = await this.viewCollection(
        {
          name: attributes.name,
          context: attributes.context,
        },
        adapters,
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

    try {
      const collection = await this.causationCollection();

      const documents: Array<ViewStoreCausationAttributes> = causationIds.map((causationId) => ({
        view_id: identifier.id,
        view_name: identifier.name,
        view_context: identifier.context,
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
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    try {
      const collection = await this.viewCollection(filter, adapters);

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

  private async viewCollection(
    view: HandlerIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<Collection<ViewStoreAttributes>> {
    const name = MongoViewStore.getCollectionName(view, adapters.mongo?.collection);
    await this.createIndices(name, VIEW_COLLECTION_INDICES);

    return this.connection.database.collection(name);
  }

  private async causationCollection(): Promise<Collection<ViewStoreCausationAttributes>> {
    return this.connection.database.collection(VIEW_CAUSATION_COLLECTION);
  }

  // private static

  public static getCollectionName(view: HandlerIdentifier, collection?: string): string {
    return collection || `view_${snakeCase(view.context)}_${snakeCase(view.name)}`;
  }
}
