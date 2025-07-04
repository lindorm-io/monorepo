import { ILogger } from "@lindorm/logger";
import { IHermesMessageBus, IHermesViewStore } from "../../interfaces";

export type ViewDomainOptions = {
  logger: ILogger;
  errorBus: IHermesMessageBus;
  eventBus: IHermesMessageBus;
  store: IHermesViewStore;
};
