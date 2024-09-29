import { ILogger } from "@lindorm/logger";
import { IHermesMessageBus, IHermesViewStore } from "../../interfaces";

export type ViewDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
  store: IHermesViewStore;
};
