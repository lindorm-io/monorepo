import { ILogger } from "@lindorm/logger";
import { IEventStore, IHermesEncryptionStore, IHermesMessageBus } from "../../interfaces";

export type AggregateDomainOptions = {
  encryptionStore: IHermesEncryptionStore;
  eventStore: IEventStore;
  logger: ILogger;
  messageBus: IHermesMessageBus;
};
