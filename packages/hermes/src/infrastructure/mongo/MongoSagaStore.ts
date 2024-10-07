import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection } from "mongodb";
import {
  SAGA_CAUSATION,
  SAGA_CAUSATION_INDEXES,
  SAGA_STORE,
  SAGA_STORE_INDEXES,
} from "../../constants/private";
import { MongoNotUpdatedError } from "../../errors";
import { ISagaStore } from "../../interfaces";
import {
  SagaCausationAttributes,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
  SagaUpdateFilter,
} from "../../types";
import { MongoBase } from "./MongoBase";

export class MongoSagaStore extends MongoBase implements ISagaStore {
  private promise: () => Promise<void>;

  public constructor(source: IMongoSource, logger: ILogger) {
    super(source, logger);

    this.promise = this.initialise;
  }

  // public

  public async findCausationIds(sagaIdentifier: SagaIdentifier): Promise<Array<string>> {
    this.logger.debug("Finding causation ids", { sagaIdentifier });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const array = await collection
        .find({
          id: sagaIdentifier.id,
          name: sagaIdentifier.name,
          context: sagaIdentifier.context,
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

  public async findSaga(
    sagaIdentifier: SagaIdentifier,
  ): Promise<SagaStoreAttributes | undefined> {
    this.logger.debug("Finding saga", { sagaIdentifier });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.findOne({
        id: sagaIdentifier.id,
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
      });

      if (!result) {
        this.logger.debug("Saga not found");
        return;
      }

      this.logger.debug("Found saga", { result });

      return result;
    } catch (err: any) {
      this.logger.error("Failed to find saga", err);
      throw err;
    }
  }

  public async insertCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting causation ids", { sagaIdentifier, causationIds });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const documents: Array<SagaCausationAttributes> = causationIds.map(
        (causationId) => ({
          id: sagaIdentifier.id,
          name: sagaIdentifier.name,
          context: sagaIdentifier.context,
          causation_id: causationId,
          created_at: new Date(),
        }),
      );

      const result = await collection.insertMany(documents);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert causation ids", err);
      throw err;
    }
  }

  public async insertSaga(attributes: SagaStoreAttributes): Promise<void> {
    this.logger.debug("Inserting saga", { attributes });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.insertOne(attributes);

      this.logger.debug("Inserted saga", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert saga", err);
      throw err;
    }
  }

  // public

  public async updateSaga(
    filter: SagaUpdateFilter,
    data: SagaUpdateAttributes,
  ): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.updateOne(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          revision: filter.revision,
        },
        {
          $set: {
            destroyed: data.destroyed,
            messages_to_dispatch: data.messages_to_dispatch,
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

      this.logger.debug("Updated saga", { result });
    } catch (err: any) {
      this.logger.error("Failed to update saga", err);
      throw err;
    }
  }

  // private

  private async initialise(): Promise<void> {
    await this.connect();

    await this.createIndexes(SAGA_STORE, SAGA_STORE_INDEXES);
    await this.createIndexes(SAGA_CAUSATION, SAGA_CAUSATION_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async sagaCollection(): Promise<Collection<SagaStoreAttributes>> {
    return this.source.database.collection(SAGA_STORE);
  }

  private async causationCollection(): Promise<Collection<SagaCausationAttributes>> {
    return this.source.database.collection(SAGA_CAUSATION);
  }
}
