import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import {
  IEventStore,
  IHermesEncryptionStore,
  IHermesMessageBus,
  IHermesRegistry,
} from "../../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../../messages";

export type AggregateDomainOptions = {
  commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  encryptionStore: IHermesEncryptionStore;
  errorBus: IHermesMessageBus<HermesError>;
  eventBus: IHermesMessageBus<HermesEvent>;
  eventStore: IEventStore;
  logger: ILogger;
  registry: IHermesRegistry;
};
