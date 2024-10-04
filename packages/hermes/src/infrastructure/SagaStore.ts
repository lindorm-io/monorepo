import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { MongoSource } from "@lindorm/mongo";
import { PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
import { IHermesMessage, IHermesSagaStore, ISaga, ISagaStore } from "../interfaces";
import { Saga } from "../models";
import {
  HermesSagaStoreOptions,
  SagaData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../types";
import { MongoSagaStore } from "./mongo";
import { PostgresSagaStore } from "./postgres";

export class SagaStore implements IHermesSagaStore {
  private readonly store: ISagaStore;
  private readonly logger: ILogger;

  public constructor(options: HermesSagaStoreOptions) {
    this.logger = options.logger.child(["SagaStore"]);

    if (options.custom) {
      this.store = options.custom;
    } else if (options.mongo instanceof MongoSource) {
      this.store = new MongoSagaStore(options.mongo, this.logger);
    } else if (options.postgres instanceof PostgresSource) {
      this.store = new PostgresSagaStore(options.postgres, this.logger);
    } else {
      throw new LindormError("Invalid SagaStore configuration");
    }
  }

  // public

  public async clearMessages(saga: ISaga): Promise<ISaga> {
    this.logger.debug("Clearing messages", { saga: saga.toJSON() });

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
      messages_to_dispatch: [],
      processed_causation_ids: saga.processedCausationIds,
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return new Saga({ ...saga.toJSON(), ...data, logger: this.logger });
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<ISaga> {
    this.logger.debug("Loading saga", { sagaIdentifier });

    const existing = await this.store.findSaga(sagaIdentifier);

    if (existing) {
      this.logger.debug("Loading existing saga", { existing });

      return new Saga({ ...SagaStore.toData(existing), logger: this.logger });
    }

    const saga = new Saga({ ...sagaIdentifier, logger: this.logger });

    this.logger.debug("Loading ephemeral saga", { saga: saga.toJSON() });

    return saga;
  }

  public async loadCausations(sagaIdentifier: SagaIdentifier): Promise<Array<string>> {
    return await this.store.findCausationIds(sagaIdentifier);
  }

  public async save(saga: ISaga, causation: IHermesMessage): Promise<ISaga> {
    this.logger.debug("Saving saga", { saga: saga.toJSON(), causation });

    const sagaIdentifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
    };

    const existing = await this.store.findSaga(sagaIdentifier);

    if (existing) {
      if (existing.processed_causation_ids.includes(causation.id)) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return new Saga({ ...SagaStore.toData(existing), logger: this.logger });
      }

      const causations = await this.store.findCausationIds(sagaIdentifier);

      if (causations.includes(causation.id)) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return new Saga({ ...SagaStore.toData(existing), logger: this.logger });
      }
    }

    if (saga.revision === 0) {
      const data: SagaData = {
        ...saga.toJSON(),
        hash: randomString(16),
        processedCausationIds: [causation.id],
        revision: saga.revision + 1,
      };

      await this.store.insertSaga(SagaStore.toAttributes(data));

      return new Saga({ ...data, logger: this.logger });
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
      processed_causation_ids: [saga.processedCausationIds, causation.id].flat(),
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return new Saga({ ...saga.toJSON(), ...data, logger: this.logger });
  }

  public async saveCausations(saga: ISaga): Promise<ISaga> {
    this.logger.debug("Saving causations", { saga: saga.toJSON() });

    if (!saga.processedCausationIds.length) {
      this.logger.debug("No causations to save", { saga: saga.toJSON() });
      return saga;
    }

    const sagaIdentifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
    };

    const causations = await this.store.findCausationIds(sagaIdentifier);
    const insert = saga.processedCausationIds.filter((id) => !causations.includes(id));

    if (insert.length) {
      this.logger.debug("Inserting causations", { insert });
      await this.store.insertCausationIds(sagaIdentifier, insert);
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
      processed_causation_ids: [],
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return new Saga({ ...saga.toJSON(), ...data, logger: this.logger });
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
