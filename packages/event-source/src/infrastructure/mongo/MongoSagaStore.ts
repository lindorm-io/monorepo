import { Collection } from "mongodb";
import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoNotUpdatedError } from "../../error";
import {
  SAGA_CAUSATION,
  SAGA_CAUSATION_INDEXES,
  SAGA_STORE,
  SAGA_STORE_INDEXES,
} from "../../constant";
import {
  IMessage,
  ISagaStore,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaCausationAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

export class MongoSagaStore extends MongoBase implements ISagaStore {
  private promise: () => Promise<void>;

  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger);

    this.promise = this.initialise;
  }

  // public

  public async causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean> {
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
    } catch (err: any) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    this.logger.debug("Clearing messages", { filter, data });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.updateOne(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          $set: {
            hash: data.hash,
            messages_to_dispatch: data.messages_to_dispatch,
            revision: data.revision,
            updated_at: new Date(),
          },
        },
      );

      if (!result.acknowledged) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Cleared messages", { result });
    } catch (err: any) {
      this.logger.error("Failed to clear messages", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.updateOne(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
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

  public async find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    this.logger.debug("Finding saga", { identifier });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.findOne({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
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

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
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

  public async insertProcessedCausationIds(
    identifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { identifier, causationIds });

    await this.promise();

    try {
      const collection = await this.causationCollection();

      const documents: Array<SagaCausationAttributes> = causationIds.map((causationId) => ({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        causation_id: causationId,
        timestamp: new Date(),
      }));

      const result = await collection.insertMany(documents);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

    await this.promise();

    try {
      const collection = await this.sagaCollection();

      const result = await collection.updateOne(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          $set: {
            destroyed: data.destroyed,
            hash: data.hash,
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
    await this.createIndexes(SAGA_STORE, SAGA_STORE_INDEXES);
    await this.createIndexes(SAGA_CAUSATION, SAGA_CAUSATION_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async sagaCollection(): Promise<Collection<SagaStoreAttributes>> {
    return this.connection.database.collection(SAGA_STORE);
  }

  private async causationCollection(): Promise<Collection<SagaCausationAttributes>> {
    return this.connection.database.collection(SAGA_CAUSATION);
  }
}
