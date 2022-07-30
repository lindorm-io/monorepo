import { ILogger } from "@lindorm-io/winston";
import { MongoSagaStore } from "./mongo";
import { PostgresSagaStore } from "./postgres";
import { Saga } from "../entity";
import {
  IMessage,
  ISaga,
  ISagaStore,
  SagaIdentifier,
  SagaStoreHandlerOptions,
  SagaStoreOptions,
} from "../types";

export class SagaStore implements ISagaStore {
  private readonly store: ISagaStore;

  public constructor(options: SagaStoreOptions, logger: ILogger) {
    switch (options.type) {
      case "custom":
        if (!options.custom) throw new Error("Connection not provided");
        this.store = options.custom;
        break;

      case "mongo":
        if (!options.mongo) throw new Error("Connection not provided");
        this.store = new MongoSagaStore(options.mongo, logger);
        break;

      case "postgres":
        if (!options.postgres) throw new Error("Connection not provided");
        this.store = new PostgresSagaStore(options.postgres, logger);
        break;

      default:
        break;
    }
  }

  // public

  public save(
    saga: ISaga,
    causation: IMessage,
    handlerOptions?: SagaStoreHandlerOptions,
  ): Promise<Saga> {
    return this.store.save(saga, causation, handlerOptions);
  }

  public load(identifier: SagaIdentifier): Promise<Saga> {
    return this.store.load(identifier);
  }

  public clearMessagesToDispatch(
    saga: ISaga,
    handlerOptions?: SagaStoreHandlerOptions,
  ): Promise<Saga> {
    return this.store.clearMessagesToDispatch(saga, handlerOptions);
  }
}
