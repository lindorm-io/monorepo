import { ILogger } from "@lindorm/logger";
import { IEventStore, IHermesMessageBus } from "../../interfaces";

export type AggregateDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
  store: IEventStore;
};
