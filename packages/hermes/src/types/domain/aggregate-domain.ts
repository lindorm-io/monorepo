import { ILogger } from "@lindorm/logger";
import { IHermesEventStore, IHermesMessageBus } from "../../interfaces";

export type AggregateDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
  store: IHermesEventStore;
};
