import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection } from "mongodb";
import {
  getViewStoreIndexes,
  VIEW_CAUSATION,
  VIEW_CAUSATION_INDEXES,
} from "../../constants/private";
import { MongoNotUpdatedError } from "../../errors";
import { IViewStore } from "../../interfaces";
import {
  HandlerIdentifier,
  ViewCausationAttributes,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
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

  public async findCausationIds(viewIdentifier: ViewIdentifier): Promise<Array<string>> {
    this.logger.debug("Finding causation ids", { viewIdentifier });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const array = await collection
        .find({
          id: viewIdentifier.id,
          name: viewIdentifier.name,
          context: viewIdentifier.context,
        })
        .toArray();

      const causationIds = array.map((item) => item.causation_id);

      this.logger.debug("Found causation ids", { causationIds });

      return causationIds;
    } catch (err: any) {
      this.logger.error("Failed to find causation ids", err);
      throw err;
    }
  }

  public async findView(
    viewIdentifier: ViewIdentifier,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { viewIdentifier });

    await this.initialise(viewIdentifier);

    try {
      const collection = await this.viewCollection(viewIdentifier);

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

  public async insertCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting causation ids", {
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
          created_at: new Date(),
        }),
      );

      const result = await collection.insertMany(documents);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async insertView(attributes: ViewStoreAttributes): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    await this.initialise(attributes);

    try {
      const collection = await this.viewCollection({
        name: attributes.name,
        context: attributes.context,
      });

      const result = await collection.insertOne(attributes);

      this.logger.debug("Inserted view", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async updateView(
    filter: ViewUpdateFilter,
    data: ViewUpdateAttributes,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    await this.initialise(filter);

    try {
      const collection = await this.viewCollection(filter);

      const result = await collection.updateOne(
        {
          id: filter.id,
          revision: filter.revision,
        },
        {
          $set: {
            destroyed: data.destroyed,
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

  private async initialise(handlerIdentifier: HandlerIdentifier): Promise<void> {
    await this.promise();

    if (
      this.initialisedViews.find(
        (x) =>
          x.name === handlerIdentifier.name && x.context === handlerIdentifier.context,
      )
    )
      return;

    const storeName = getViewStoreName(handlerIdentifier);
    const indexes = getViewStoreIndexes(handlerIdentifier);

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
  ): Promise<Collection<ViewStoreAttributes>> {
    const storeName = getViewStoreName(handlerIdentifier);
    const indexes = getViewStoreIndexes(handlerIdentifier);

    await this.createIndexes(storeName, indexes);

    return this.source.database.collection(storeName);
  }

  private async causationCollection(): Promise<Collection<ViewCausationAttributes>> {
    return this.source.database.collection(VIEW_CAUSATION);
  }
}
