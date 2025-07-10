import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { IHermesMessage, IHermesSagaStore, ISagaModel, ISagaStore } from "../interfaces";
import {
  HermesSagaStoreOptions,
  SagaData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
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
    } else if (options.mongo?.name === "MongoSource") {
      this.store = new MongoSagaStore(options.mongo, this.logger);
    } else if (options.postgres?.name === "PostgresSource") {
      this.store = new PostgresSagaStore(options.postgres, this.logger);
    } else {
      throw new LindormError("Invalid SagaStore configuration");
    }
  }

  // public

  public async clearMessages(saga: ISagaModel): Promise<SagaData> {
    this.logger.debug("Clearing messages", { saga: saga.toJSON() });

    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      revision: saga.revision,
    };

    const data: SagaUpdateAttributes = {
      destroyed: saga.destroyed,
      messages_to_dispatch: [],
      processed_causation_ids: saga.processedCausationIds,
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return {
      ...saga.toJSON(),
      destroyed: data.destroyed,
      messagesToDispatch: data.messages_to_dispatch,
      processedCausationIds: data.processed_causation_ids,
      revision: data.revision,
      state: data.state,
    };
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<SagaData> {
    this.logger.debug("Loading saga", { sagaIdentifier });

    const existing = await this.store.findSaga({
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      namespace: sagaIdentifier.namespace,
    });

    if (existing) {
      this.logger.debug("Loading existing saga", { existing });

      return SagaStore.toData(existing);
    }

    const saga: SagaData = {
      ...sagaIdentifier,
      destroyed: false,
      messagesToDispatch: [],
      processedCausationIds: [],
      revision: 0,
      state: {},
    };

    this.logger.debug("Loading ephemeral saga", { saga });

    return saga;
  }

  public async loadCausations(sagaIdentifier: SagaIdentifier): Promise<Array<string>> {
    return await this.store.findCausationIds(sagaIdentifier);
  }

  public async save(saga: ISagaModel, causation: IHermesMessage): Promise<SagaData> {
    this.logger.debug("Saving saga", { saga: saga.toJSON(), causation });

    const sagaIdentifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
    };

    const existing = await this.store.findSaga(sagaIdentifier);

    if (existing) {
      if (existing.processed_causation_ids.includes(causation.id)) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return SagaStore.toData(existing);
      }

      const causations = await this.store.findCausationIds(sagaIdentifier);

      if (causations.includes(causation.id)) {
        this.logger.debug("Found existing saga matching causation", { existing });

        return SagaStore.toData(existing);
      }
    }

    if (saga.revision === 0) {
      const data: SagaData = {
        ...saga.toJSON(),
        processedCausationIds: [causation.id],
        revision: saga.revision + 1,
      };

      await this.store.insertSaga(SagaStore.toAttributes(data));

      return data;
    }

    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      revision: saga.revision,
    };

    const data: SagaUpdateAttributes = {
      destroyed: saga.destroyed,
      messages_to_dispatch: saga.messagesToDispatch,
      processed_causation_ids: [saga.processedCausationIds, causation.id].flat(),
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return {
      ...saga.toJSON(),
      destroyed: data.destroyed,
      messagesToDispatch: data.messages_to_dispatch,
      processedCausationIds: data.processed_causation_ids,
      revision: data.revision,
      state: data.state,
    };
  }

  public async saveCausations(saga: ISagaModel): Promise<SagaData> {
    this.logger.debug("Saving causations", { saga: saga.toJSON() });

    if (!saga.processedCausationIds.length) {
      this.logger.debug("No causations to save", { saga: saga.toJSON() });
      return saga;
    }

    const sagaIdentifier: SagaIdentifier = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
    };

    const causations = await this.store.findCausationIds(sagaIdentifier);
    const insert = saga.processedCausationIds.filter((id) => !causations.includes(id));

    if (insert.length) {
      this.logger.debug("Inserting causations", {
        insert,
        saga: saga.processedCausationIds,
      });
      await this.store.insertCausationIds(sagaIdentifier, insert);
    }

    const filter: SagaUpdateFilter = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      revision: saga.revision,
    };

    const data: SagaUpdateAttributes = {
      destroyed: saga.destroyed,
      messages_to_dispatch: saga.messagesToDispatch,
      processed_causation_ids: [],
      revision: saga.revision + 1,
      state: saga.state,
    };

    await this.store.updateSaga(filter, data);

    return {
      ...saga.toJSON(),
      destroyed: data.destroyed,
      messagesToDispatch: data.messages_to_dispatch,
      processedCausationIds: data.processed_causation_ids,
      revision: data.revision,
      state: data.state,
    };
  }

  // private

  private static toAttributes(data: SagaData): SagaStoreAttributes {
    return {
      id: data.id,
      name: data.name,
      namespace: data.namespace,
      destroyed: data.destroyed,
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
      namespace: attributes.namespace,
      destroyed: attributes.destroyed,
      messagesToDispatch: attributes.messages_to_dispatch,
      processedCausationIds: attributes.processed_causation_ids,
      revision: attributes.revision,
      state: attributes.state,
    };
  }
}
