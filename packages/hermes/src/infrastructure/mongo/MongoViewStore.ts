import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection } from "mongodb";
import {
  getViewStoreIndexes,
  VIEW_CAUSATION,
  VIEW_CAUSATION_INDEXES,
} from "../../constants/private";
import { MongoNotUpdatedError } from "../../errors";
import { IHermesMessage, IViewStore } from "../../interfaces";
import {
  HandlerIdentifier,
  ViewCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { MongoBase } from "./MongoBase";

export class MongoViewStore extends MongoBase implements IViewStore {
  private readonly initialisedViews: Array<HandlerIdentifier>;
  private promise: () => Promise<void>;

  public constructor(connection: IMongoSource, logger: ILogger) {
    super(connection, logger);

    this.initialisedViews = [];
    this.promise = this.initialiseCausation;
  }

  // public

  public async causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { viewIdentifier, causation });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const result = await collection.findOne({
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
        causation_id: causation.id,
      });

      return !!result;
    } catch (err: any) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    await this.initialise(filter, adapter);

    try {
      const collection = await this.viewCollection(filter, adapter);

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
    } catch (err: any) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { viewIdentifier });

    await this.initialise(viewIdentifier, adapter);

    try {
      const collection = await this.viewCollection(viewIdentifier, adapter);

      const result = await collection.findOne({ id: viewIdentifier.id });

      if (!result) {
        this.logger.debug("View not found");

        return;
      }

      this.logger.debug("Found view", { result });

      return result;
    } catch (err: any) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    await this.initialise(attributes, adapter);

    try {
      const collection = await this.viewCollection(
        {
          name: attributes.name,
          context: attributes.context,
        },
        adapter,
      );

      const result = await collection.insertOne(attributes);

      this.logger.debug("Inserted view", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", {
      viewIdentifier,
      causationIds,
    });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const documents: Array<ViewCausationAttributes> = causationIds.map(
        (causationId) => ({
          id: viewIdentifier.id,
          name: viewIdentifier.name,
          context: viewIdentifier.context,
          causation_id: causationId,
          timestamp: new Date(),
        }),
      );

      const result = await collection.insertMany(documents);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    await this.initialise(filter, adapter);

    try {
      const collection = await this.viewCollection(filter, adapter);

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
    } catch (err: any) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }

  // private

  private async initialise(
    handlerIdentifier: HandlerIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    await this.promise();

    if (
      this.initialisedViews.find(
        (x) =>
          x.name === handlerIdentifier.name && x.context === handlerIdentifier.context,
      )
    )
      return;

    const storeName = getViewStoreName(handlerIdentifier);
    const custom = adapter.indexes || [];
    const indexes = [getViewStoreIndexes(handlerIdentifier), custom].flat();

    await this.createIndexes(storeName, indexes);

    this.initialisedViews.push(handlerIdentifier);
  }

  private async initialiseCausation(): Promise<void> {
    await this.connect();
    await this.createIndexes(VIEW_CAUSATION, VIEW_CAUSATION_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async viewCollection(
    handlerIdentifier: HandlerIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<Collection<ViewStoreAttributes>> {
    const storeName = getViewStoreName(handlerIdentifier);
    const custom = adapter.indexes || [];
    const indexes = [getViewStoreIndexes(handlerIdentifier), custom].flat();

    await this.createIndexes(storeName, indexes);

    return this.source.database.collection(storeName);
  }

  private async causationCollection(): Promise<Collection<ViewCausationAttributes>> {
    return this.source.database.collection(VIEW_CAUSATION);
  }
}
