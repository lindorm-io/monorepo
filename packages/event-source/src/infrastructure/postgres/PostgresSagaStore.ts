import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { Saga } from "../../model";
import { SagaCausationEntity, SagaEntity } from "./entity";
import { find } from "lodash";
import {
  IMessage,
  ISaga,
  ISagaStore,
  SagaData,
  SagaIdentifier,
  SagaStoreHandlerOptions,
} from "../../types";

export class PostgresSagaStore extends PostgresBase implements ISagaStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
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
      {},
      { where: { causation_id: causation.id } },
    );

    if (existing && find(existing.processedCausationIds, causation.id)) {
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
    sagaOptions: FindOneOptions<SagaEntity> = {},
    causationOptions: FindManyOptions<SagaCausationEntity> = {},
  ): Promise<Saga | undefined> {
    await this.promise();

    const sagaFilter: FindOneOptions<SagaEntity> = {
      cache: false,
      where: {
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
        ...(sagaOptions.where || {}),
      },
      ...sagaOptions,
    };

    const causationFilter: FindManyOptions<SagaCausationEntity> = {
      cache: true,
      order: {
        timestamp: "ASC",
        ...(causationOptions.order || {}),
      },
      where: {
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
        ...(causationOptions.where || {}),
      },
      ...causationOptions,
    };

    this.logger.debug("Finding saga", {
      sagaFilter,
      causationFilter,
    });

    try {
      const sagaEntity = await this.connection.getRepository(SagaEntity).findOne(sagaFilter);

      if (!sagaEntity) {
        this.logger.debug("Saga not found");
        return;
      }

      this.logger.debug("Found saga entity", { sagaEntity });

      const causationEntities = await this.connection
        .getRepository(SagaCausationEntity)
        .find(causationFilter);

      this.logger.debug("Found causation entities", { causationEntities });

      const processedCausationIds: Array<string> = [];
      for (const entity of causationEntities) {
        processedCausationIds.push(entity.causation_id);
      }

      return new Saga(
        {
          id: sagaEntity.id,
          name: sagaEntity.name,
          context: sagaEntity.context,
          processedCausationIds,
          destroyed: sagaEntity.destroyed,
          messagesToDispatch: sagaEntity.messages_to_dispatch,
          revision: sagaEntity.revision,
          state: sagaEntity.state,
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
    handlerOptions: SagaStoreHandlerOptions = {},
  ): Promise<Saga> {
    await this.promise();

    this.logger.debug("Inserting saga", {
      saga,
      causation,
      handlerOptions,
    });

    try {
      return await this.connection.transaction<Saga>(async (manager) => {
        const savedSaga = await manager.getRepository(SagaEntity).save({
          id: saga.id,
          name: saga.name,
          context: saga.context,
          destroyed: saga.destroyed,
          messages_to_dispatch: saga.messagesToDispatch,
          state: saga.state,
        });

        const savedCausation = await manager.getRepository(SagaCausationEntity).save({
          saga_id: saga.id,
          saga_name: saga.name,
          saga_context: saga.context,
          causation_id: causation.id,
        });

        this.logger.debug("Saved saga", {
          savedCausation,
          savedSaga,
        });

        return new Saga(
          {
            ...saga,
            processedCausationIds: [causation.id],
            revision: savedSaga.revision,
          },
          this.logger,
        );
      });
    } catch (err) {
      this.logger.error("Failed to insert saga", err);

      throw err;
    }
  }

  private async update(
    saga: SagaData,
    causation: IMessage,
    handlerOptions: SagaStoreHandlerOptions = {},
  ): Promise<Saga> {
    await this.promise();

    this.logger.debug("Updating saga", {
      saga,
      causation,
      handlerOptions,
    });

    try {
      return await this.connection.transaction<Saga>(async (manager) => {
        const result = await manager.getRepository(SagaEntity).update(
          {
            id: saga.id,
            name: saga.name,
            context: saga.context,
            revision: saga.revision,
          },
          {
            destroyed: saga.destroyed,
            messages_to_dispatch: saga.messagesToDispatch,
            state: saga.state,
          },
        );

        const causationEntity = await manager.getRepository(SagaCausationEntity).save({
          saga_id: saga.id,
          saga_name: saga.name,
          saga_context: saga.context,
          causation_id: causation.id,
        });

        this.logger.debug("Updated saga entity", {
          result,
          causation: causationEntity,
        });

        return new Saga(
          {
            ...saga,
            processedCausationIds: [...saga.processedCausationIds, causation.id],
            revision: saga.revision + 1,
          },
          this.logger,
        );
      });
    } catch (err) {
      this.logger.error("Failed to update saga", err);

      throw err;
    }
  }

  private async clear(saga: SagaData, handlerOptions: SagaStoreHandlerOptions = {}): Promise<Saga> {
    await this.promise();

    this.logger.debug("Clearing saga messages", {
      saga,
      handlerOptions,
    });

    try {
      const result = await this.connection.getRepository(SagaEntity).update(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          revision: saga.revision,
        },
        {
          messages_to_dispatch: [],
        },
      );

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
