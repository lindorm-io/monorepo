import { ILogger } from "@lindorm/logger";
import { IHermesMessageBus, IHermesSagaStore } from "../../interfaces";

export type SagaDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
  store: IHermesSagaStore;
};
