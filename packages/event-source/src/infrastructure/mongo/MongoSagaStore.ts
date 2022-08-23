import { Collection } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoNotUpdatedError } from "../../error";
import {
  SAGA_CAUSATION_COLLECTION,
  SAGA_CAUSATION_COLLECTION_INDICES,
  SAGA_COLLECTION,
  SAGA_COLLECTION_INDICES,
} from "../../constant";
import {
  IMessage,
  ISagaStore,
  SagaStoreAttributes,
  SagaStoreCausationAttributes,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

export class MongoSagaStore extends MongoBase implements ISagaStore {
  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

  public async initialise(): Promise<void> {
    await this.createIndices(SAGA_COLLECTION, SAGA_COLLECTION_INDICES);
    await this.createIndices(SAGA_CAUSATION_COLLECTION, SAGA_CAUSATION_COLLECTION_INDICES);
  }

  public async causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    try {
      const collection = await this.causationCollection();

      const result = await collection.findOne({
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
        causation_id: causation.id,
      });

      return !!result;
    } catch (err) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    this.logger.debug("Clearing messages", { filter, data });

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
    } catch (err) {
      this.logger.error("Failed to clear messages", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

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
    } catch (err) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(identifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    this.logger.debug("Finding saga", { identifier });

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
    } catch (err) {
      this.logger.error("Failed to find saga", err);

      throw err;
    }
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    this.logger.debug("Inserting saga", { attributes });

    try {
      const collection = await this.sagaCollection();

      const result = await collection.insertOne(attributes);

      this.logger.debug("Inserted saga", { result });
    } catch (err) {
      this.logger.error("Failed to insert saga", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    identifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { identifier, causationIds });

    try {
      const collection = await this.causationCollection();

      const documents: Array<SagaStoreCausationAttributes> = causationIds.map((causationId) => ({
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
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

  public async update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

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
    } catch (err) {
      this.logger.error("Failed to update saga", err);

      throw err;
    }
  }

  // private

  private async sagaCollection(): Promise<Collection<SagaStoreAttributes>> {
    return this.connection.database.collection(SAGA_COLLECTION);
  }

  private async causationCollection(): Promise<Collection<SagaStoreCausationAttributes>> {
    return this.connection.database.collection(SAGA_CAUSATION_COLLECTION);
  }
}
