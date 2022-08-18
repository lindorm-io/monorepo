import { IMessage } from "../message";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { ISaga, SagaIdentifier } from "../model";
import { MongoSagaStoreHandlerOptions } from "./saga-store-mongo";
import { Saga } from "../../model";

export type SagaStorePersistenceType = "custom" | "mongo" | "postgres";

export interface SagaStoreOptions {
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  custom?: ISagaStore;
  type: SagaStorePersistenceType;
}

export interface SagaStoreHandlerOptions {
  mongo?: MongoSagaStoreHandlerOptions;
}

export interface ISagaStore {
  save(saga: ISaga, causation: IMessage, handlerOptions?: SagaStoreHandlerOptions): Promise<Saga>;
  load(identifier: SagaIdentifier): Promise<Saga>;
  clearMessagesToDispatch(saga: ISaga, handlerOptions?: SagaStoreHandlerOptions): Promise<Saga>;
}
