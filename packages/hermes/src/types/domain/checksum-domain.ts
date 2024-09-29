import { ILogger } from "@lindorm/logger";
import { IHermesChecksumStore, IHermesMessageBus } from "../../interfaces";

export type ChecksumDomainOptions = {
  logger: ILogger;
  messageBus: IHermesMessageBus;
  store: IHermesChecksumStore;
};
