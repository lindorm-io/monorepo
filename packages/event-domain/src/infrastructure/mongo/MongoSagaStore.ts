import { Filter, FindOptions } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../../error";
import { Saga } from "../../entity";
import {
  IMessage,
  ISaga,
  ISagaStore,
  MongoSagaStoreAttributes,
  SagaData,
  SagaIdentifier,
  SagaStoreHandlerOptions,
} from "../../types";

export class MongoSagaStore extends MongoBase<MongoSagaStoreAttributes> implements ISagaStore {
  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(
      {
        connection,
        collection: "sagas",
        indices: [
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
              revision: 1,
            },
            createIndexesOptions: {
              name: "unique_revision",
              unique: true,
            },
          },
        ],
      },
      logger,
    );
  }

  // public

  public async save(
    saga: ISaga,
    causation: IMessage,
    handlerOptions: SagaStoreHandlerOptions = {},
  ): Promise<Saga> {
    const json = saga.toJSON();

    this.logger.debug("Saving saga", {
      saga: json,
      causation,
      handlerOptions,
    });

    const existing = await this.find(
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
      this.logger.debug("Found existing saga matching causation", { saga: existing.toJSON() });

      return existing;
    }

    if (json.revision === 0) {
      return await this.insert(json, causation, handlerOptions);
    }

    return await this.update(json, causation, handlerOptions);
  }

  public async load(identifier: SagaIdentifier): Promise<Saga> {
    this.logger.debug("Loading saga", { identifier });

    const existing = await this.find(identifier);

    if (existing) {
      this.logger.debug("Loading existing saga", { saga: existing.toJSON() });

      return existing;
    }

    const saga = new Saga(identifier, this.logger);

    this.logger.debug("Loading ephemeral saga", { saga: saga.toJSON() });

    return saga;
  }

  public async clearMessagesToDispatch(
    saga: ISaga,
    handlerOptions: SagaStoreHandlerOptions = {},
  ): Promise<Saga> {
    const json = saga.toJSON();

    return await this.clear(json, handlerOptions);
  }

  // private

  private async find(
    identifier: SagaIdentifier,
    findFilter: Filter<MongoSagaStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Saga | undefined> {
    await this.promise();

    const filter = { ...identifier, ...findFilter };
    const projection: Partial<Record<keyof MongoSagaStoreAttributes, number>> = {
      id: 1,
      name: 1,
      context: 1,
      causation_list: 1,
      destroyed: 1,
      messages_to_dispatch: 1,
      revision: 1,
      state: 1,
    };
    const options = {
      ...findOptions,
      projection: findOptions.projection || projection,
    };

    this.logger.debug("Finding saga", {
      filter,
      options,
    });

    try {
      const result = await this.collection.findOne(filter, options);

      if (!result) {
        this.logger.debug("Saga not found");
        return;
      }

      this.logger.debug("Found saga document", { result });

      return new Saga(
        {
          id: result.id,
          name: result.name,
          context: result.context,
          causationList: result.causation_list,
          destroyed: result.destroyed,
          messagesToDispatch: result.messages_to_dispatch,
          revision: result.revision,
          state: result.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to find saga", err);

      throw err;
    }
  }

  private async insert(
    saga: SagaData,
    causation: IMessage,
    handlerOptions: SagaStoreHandlerOptions,
  ): Promise<Saga> {
    await this.promise();

    this.logger.debug("Inserting saga", {
      saga,
      causation,
      handlerOptions,
    });

    try {
      const result = await this.collection.insertOne({
        id: saga.id,
        name: saga.name,
        context: saga.context,
        causation_list: [causation.id],
        destroyed: saga.destroyed,
        messages_to_dispatch: saga.messagesToDispatch,
        revision: saga.revision + 1,
        state: saga.state,
        timestamp_created: new Date(),
        timestamp_modified: new Date(),
      });

      this.logger.debug("Saved saga", { saga: result });

      return new Saga(
        {
          ...saga,
          causationList: [causation.id],
          revision: saga.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to insert saga", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async update(
    saga: SagaData,
    causation: IMessage,
    handlerOptions: SagaStoreHandlerOptions,
  ): Promise<Saga> {
    await this.promise();

    this.logger.debug("Updating saga", {
      saga,
      causation,
      handlerOptions,
    });

    try {
      const result = await this.collection.findOneAndUpdate(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          revision: saga.revision,
        },
        {
          $set: {
            destroyed: saga.destroyed,
            messages_to_dispatch: saga.messagesToDispatch,
            revision: saga.revision + 1,
            state: saga.state,
            timestamp_modified: new Date(),
          },
          $push: {
            causation_list: (handlerOptions?.mongo?.causationsCap &&
            handlerOptions?.mongo?.causationsCap > 0
              ? { $each: [causation.id], $slice: handlerOptions.mongo.causationsCap * -1 }
              : causation.id) as never,
          },
        },
      );

      if (!result.ok) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Updated saga document", { result });

      return new Saga(
        {
          ...saga,
          causationList:
            handlerOptions?.mongo?.causationsCap && handlerOptions?.mongo?.causationsCap > 0
              ? [...saga.causationList, causation.id].slice(handlerOptions.mongo.causationsCap * -1)
              : [...saga.causationList, causation.id],
          revision: saga.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to update saga", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async clear(saga: SagaData, handlerOptions: SagaStoreHandlerOptions): Promise<Saga> {
    await this.promise();

    this.logger.debug("Clearing saga messages", {
      saga: saga,
      handlerOptions,
    });

    try {
      const result = await this.collection.findOneAndUpdate(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          revision: saga.revision,
        },
        {
          $set: {
            revision: saga.revision + 1,
            messages_to_dispatch: [],
            timestamp_modified: new Date(),
          },
        },
      );

      if (!result.ok) {
        throw new MongoNotUpdatedError();
      }

      this.logger.debug("Cleared saga messages", { result });

      return new Saga(
        {
          ...saga,
          messagesToDispatch: [],
          revision: saga.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to clear saga messages", err);

      throw err;
    }
  }
}
