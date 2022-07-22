import { Filter, FindOptions, UpdateFilter } from "mongodb";
import { Message } from "../message";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../error";
import { Saga } from "../entity";
import { StoreBase } from "./StoreBase";
import {
  ISagaStore,
  SagaData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaStoreOptions,
  SagaStoreSaveOptions,
} from "../types";

export class SagaStore extends StoreBase<SagaStoreAttributes> implements ISagaStore {
  public constructor(options: SagaStoreOptions) {
    super({
      ...options,
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
            revision: 1,
          },
          createIndexesOptions: {
            name: "unique_revision",
            unique: true,
          },
        },
      ],
    });
  }

  // public

  public async save(saga: Saga, causation: Message, options?: SagaStoreSaveOptions): Promise<Saga> {
    const start = Date.now();

    this.logger.debug("Saving Saga", {
      saga: saga.toJSON(),
      causation,
      options,
    });

    await this.promise();

    const existing = await this.find(
      {
        id: saga.id,
        name: saga.name,
        context: saga.context,
      },
      {
        causationList: { $in: [causation.id] },
      },
    );

    if (existing) {
      this.logger.debug("Returning existing Saga without change", {
        saga: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    if (saga.revision === 0) {
      this.logger.debug("Inserting new Saga", {
        saga: saga.toJSON(),
        time: Date.now() - start,
      });

      return await this.insert(saga, causation);
    }

    this.logger.debug("Updating existing Saga", {
      saga: saga.toJSON(),
      time: Date.now() - start,
    });

    return await this.update(saga, causation, options);
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<Saga> {
    const start = Date.now();

    this.logger.debug("Loading Saga", { sagaIdentifier });

    await this.promise();

    const existing = await this.find(sagaIdentifier);

    if (existing) {
      this.logger.debug("Returning existing Saga", {
        saga: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    const saga = new Saga(sagaIdentifier, this.logger);

    this.logger.debug("Returning ephemeral Saga", {
      saga: saga.toJSON(),
      time: Date.now() - start,
    });

    return saga;
  }

  public async clearMessagesToDispatch(saga: Saga): Promise<Saga> {
    const start = Date.now();

    await this.promise();

    const filter: Filter<SagaStoreAttributes> = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      revision: saga.revision,
    };
    const revision = saga.revision + 1;
    const update: UpdateFilter<SagaStoreAttributes> = {
      $set: {
        revision,
        messagesToDispatch: [],
        timeModified: new Date(),
      },
    };

    this.logger.debug("Clearing messages from Saga", {
      filter,
      update,
    });

    try {
      const result = await this.collection.findOneAndUpdate(filter, update);

      if (!result.ok) {
        throw new MongoNotUpdatedError(filter, update);
      }

      this.logger.debug("Successfully cleared messages from Saga", {
        result,
        time: Date.now() - start,
      });

      return new Saga(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,

          causationList: saga.causationList,
          destroyed: saga.destroyed,
          messagesToDispatch: [],
          revision,
          state: saga.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to clear messages from Saga", err);

      throw err;
    }
  }

  // private

  private async find(
    sagaIdentifier: SagaIdentifier,
    findFilter: Filter<SagaStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Saga | undefined> {
    const start = Date.now();

    const filter = { ...sagaIdentifier, ...findFilter };
    const projection: Record<keyof SagaData, number> = {
      id: 1,
      name: 1,
      context: 1,
      causationList: 1,
      destroyed: 1,
      messagesToDispatch: 1,
      revision: 1,
      state: 1,
    };
    const options = {
      ...findOptions,
      projection: findOptions.projection || projection,
    };

    this.logger.debug("Finding Saga document", {
      filter,
      options,
    });

    await this.promise();

    try {
      const result = await this.collection.findOne(filter, options);

      if (result) {
        const saga = new Saga(result, this.logger);

        this.logger.debug("Returning existing Saga document", {
          result,
          saga: saga.toJSON(),
          time: Date.now() - start,
        });

        return saga;
      }

      this.logger.debug("Found no existing Saga document", {
        time: Date.now() - start,
      });
    } catch (err) {
      this.logger.error("Failed to find Saga document", err);

      throw err;
    }
  }

  private async insert(saga: Saga, causation: Message): Promise<Saga> {
    const start = Date.now();

    await this.promise();

    const causationList = [causation.id];
    const revision = saga.revision + 1;
    const sagaData: SagaData = {
      id: saga.id,
      name: saga.name,
      context: saga.context,

      causationList,
      destroyed: saga.destroyed,
      messagesToDispatch: saga.messagesToDispatch,
      revision,
      state: saga.state,
    };
    const doc: SagaStoreAttributes = {
      ...sagaData,
      timeModified: new Date(),
      timestamp: new Date(),
    };

    this.logger.debug("Inserting Saga document", { doc });

    try {
      const result = await this.collection.insertOne(doc);

      this.logger.debug("Inserted Saga document", {
        result,
        time: Date.now() - start,
      });

      return new Saga(sagaData, this.logger);
    } catch (err) {
      this.logger.error("Failed to insert Saga document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async update(
    saga: Saga,
    causation: Message,
    options?: SagaStoreSaveOptions,
  ): Promise<Saga> {
    const start = Date.now();

    await this.promise();

    const filter: Filter<SagaStoreAttributes> = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      revision: saga.revision,
    };
    const revision = saga.revision + 1;
    const update: UpdateFilter<SagaStoreAttributes> = {
      $set: {
        destroyed: saga.destroyed,
        messagesToDispatch: saga.messagesToDispatch,
        revision,
        state: saga.state,
        timeModified: new Date(),
      },
      $push: {
        causationList: (options?.causationsCap && options?.causationsCap > 0
          ? { $each: [causation.id], $slice: options.causationsCap * -1 }
          : causation.id) as never,
      },
    };

    this.logger.debug("Updating Saga document", {
      filter,
      update,
    });

    try {
      const result = await this.collection.findOneAndUpdate(filter, update);

      if (!result.ok) {
        throw new MongoNotUpdatedError(filter, update);
      }

      this.logger.debug("Updated Saga document", {
        result,
        time: Date.now() - start,
      });

      return new Saga(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,

          causationList:
            options?.causationsCap && options?.causationsCap > 0
              ? [...saga.causationList, causation.id].slice(options.causationsCap * -1)
              : [...saga.causationList, causation.id],
          destroyed: saga.destroyed,
          messagesToDispatch: saga.messagesToDispatch,
          revision,
          state: saga.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to update Saga document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }
}
