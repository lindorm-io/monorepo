import { ILogger } from "@lindorm/logger";
import { IHermesMessageBus } from "../../interfaces";

export type ErrorDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
};
