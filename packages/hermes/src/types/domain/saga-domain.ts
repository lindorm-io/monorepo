import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesMessageBus, IHermesRegistry, IHermesSagaStore } from "../../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../../messages";

export type SagaDomainOptions = {
  commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  errorBus: IHermesMessageBus<HermesError>;
  eventBus: IHermesMessageBus<HermesEvent>;
  logger: ILogger;
  store: IHermesSagaStore;
  timeoutBus: IHermesMessageBus<HermesTimeout>;
  registry: IHermesRegistry;
};
