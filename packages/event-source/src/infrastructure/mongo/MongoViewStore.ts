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
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class MongoViewStore extends MongoBase implements IViewStore {
  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

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
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      const collection = await this.viewCollection(filter, adapterOptions);

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
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { identifier });

    try {
      const collection = await this.viewCollection(identifier, adapterOptions);

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
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      const collection = await this.viewCollection(
        {
          name: attributes.name,
          context: attributes.context,
        },
        adapterOptions,
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
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    try {
      const collection = await this.viewCollection(filter, adapterOptions);

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
    adapterOptions: ViewEventHandlerAdapters,
  ): Promise<Collection<ViewStoreAttributes>> {
    return this.collection(
      adapterOptions.mongo?.collection || MongoViewStore.getCollectionName(view),
      VIEW_COLLECTION_INDICES,
    );
  }

  private async causationCollection(): Promise<Collection<ViewStoreCausationAttributes>> {
    return this.collection(VIEW_CAUSATION_COLLECTION, VIEW_CAUSATION_COLLECTION_INDICES);
  }

  // private static

  public static getCollectionName(view: HandlerIdentifier): string {
    return `view_${snakeCase(view.context)}_${snakeCase(view.name)}`;
  }
}
