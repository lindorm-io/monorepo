import { ILogger } from "@lindorm/logger";
import { IHermesMessageBus, IHermesSagaStore } from "../../interfaces";

export type SagaDomainOptions = {
  commandBus: IHermesMessageBus;
  errorBus: IHermesMessageBus;
  eventBus: IHermesMessageBus;
  logger: ILogger;
  store: IHermesSagaStore;
  timeoutBus: IHermesMessageBus;
};
