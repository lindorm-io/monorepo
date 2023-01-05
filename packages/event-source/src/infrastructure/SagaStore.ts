import { Logger } from "@lindorm-io/core-logger";
import { MemorySagaStore } from "./memory";
import { MongoSagaStore } from "./mongo";
import { PostgresSagaStore } from "./postgres";
import { Saga } from "../model";
import { SagaStoreType } from "../enum";
import { flatten } from "lodash";
import { randomString } from "@lindorm-io/core";
import {
  IDomainSagaStore,
  IMessage,
  ISaga,
  ISagaStore,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaStoreOptions,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../types";

export class SagaStore implements IDomainSagaStore {
  private readonly store: ISagaStore;
  private readonly logger: Logger;

  public constructor(options: SagaStoreOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["SagaStore"]);

    switch (options.type) {
      case SagaStoreType.CUSTOM:
        if (!options.custom) throw new Error("Connection not provided");
        this.store = options.custom;
        break;

      case SagaStoreType.MEMORY:
        this.store = new MemorySagaStore();
        break;

      case SagaStoreType.MONGO:
        if (!options.mongo) throw new Error("Connection not provided");
        this.store = new MongoSagaStore(options.mongo, logger);
        break;

      case SagaStoreType.POSTGRES:
        if (!options.postgres) throw new Error("Connection not provided");
        this.store = new PostgresSagaStore(options.postgres, logger);
        break;

      default:
        throw new Error("Invalid SagaStore type");
    }
  }

  // public

  public async save(saga: ISaga, causation: IMessage): Promise<Saga> {
    this.logger.debug("Saving saga", { saga: saga.toJSON(), causation });

    const identifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
    };

    const existing = await this.store.find(identifier);

    if (existing) {
      const included = existing.processed_causation_ids.includes(causation.id);

      if (included) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return new Saga(SagaStore.toData(existing), this.logger);
      }

      const causationExists = await this.store.causationExists(saga, causation);

      if (causationExists) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return new Saga(SagaStore.toData(existing), this.logger);
      }
    }

    if (saga.revision === 0) {
      const data: SagaData = {
        ...saga.toJSON(),
        hash: randomString(16),
        processedCausationIds: [causation.id],
        revision: saga.revision + 1,
      };

      await this.store.insert(SagaStore.toAttributes(data));

      return new Saga(data, this.logger);
    }

    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      hash: saga.hash,
      revision: saga.revision,
    };

    const data: SagaUpdateData = {
      destroyed: saga.destroyed,
      hash: randomString(16),
      messages_to_dispatch: saga.messagesToDispatch,
      processed_causation_ids: flatten([saga.processedCausationIds, causation.id]),
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.update(filter, data);

    return new Saga({ ...saga.toJSON(), ...data }, this.logger);
  }

  public async load(identifier: SagaIdentifier): Promise<Saga> {
    this.logger.debug("Loading saga", { identifier });

    const existing = await this.store.find(identifier);

    if (existing) {
      this.logger.debug("Loading existing saga", { existing });

      return new Saga(SagaStore.toData(existing), this.logger);
    }

    const saga = new Saga(identifier, this.logger);

    this.logger.debug("Loading ephemeral saga", { saga: saga.toJSON() });

    return saga;
  }

  public async causationExists(identifier: SagaIdentifier, causation: IMessage): Promise<boolean> {
    return await this.store.causationExists(identifier, causation);
  }

  public async clearMessagesToDispatch(saga: ISaga): Promise<Saga> {
    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      hash: saga.hash,
      revision: saga.revision,
    };

    const data: SagaClearMessagesToDispatchData = {
      hash: randomString(16),
      messages_to_dispatch: [],
      revision: saga.revision + 1,
    };

    await this.store.clearMessagesToDispatch(filter, data);

    return new Saga({ ...saga.toJSON(), ...data }, this.logger);
  }

  public async clearProcessedCausationIds(saga: ISaga): Promise<Saga> {
    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      hash: saga.hash,
      revision: saga.revision,
    };

    const data: SagaClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: saga.revision + 1,
    };

    await this.store.clearProcessedCausationIds(filter, data);

    return new Saga({ ...saga.toJSON(), ...data }, this.logger);
  }

  public async processCausationIds(saga: ISaga): Promise<void> {
    const identifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
    };

    await this.store.insertProcessedCausationIds(identifier, saga.processedCausationIds);
  }

  // private

  private static toAttributes(data: SagaData): SagaStoreAttributes {
    return {
      id: data.id,
      name: data.name,
      context: data.context,
      destroyed: data.destroyed,
      hash: data.hash,
      messages_to_dispatch: data.messagesToDispatch,
      processed_causation_ids: data.processedCausationIds,
      revision: data.revision,
      state: data.state,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private static toData(attributes: SagaStoreAttributes): SagaData {
    return {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      destroyed: attributes.destroyed,
      hash: attributes.hash,
      messagesToDispatch: attributes.messages_to_dispatch,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }
}
