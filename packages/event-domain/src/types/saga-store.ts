import { Logger } from "@lindorm-io/winston";
import { Message } from "../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { Saga } from "../entity";
import { SagaData, SagaIdentifier } from "./saga";

export interface SagaStoreAttributes extends SagaData {
  timeModified: Date;
  timestamp: Date;
}

export interface SagaStoreSaveOptions {
  causationsCap?: number;
}

export interface SagaStoreOptions {
  connection: MongoConnection;
  database?: string;
  logger: Logger;
}

export interface ISagaStore {
  save(saga: Saga, causation: Message, options?: SagaStoreSaveOptions): Promise<Saga>;
  load(sagaIdentifier: SagaIdentifier): Promise<Saga>;
  clearMessagesToDispatch(saga: Saga): Promise<Saga>;
}
