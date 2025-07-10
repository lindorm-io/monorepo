import { ILogger } from "@lindorm/logger";
import {
  IHermesChecksumStore,
  IHermesMessageBus,
  IHermesRegistry,
} from "../../interfaces";
import { HermesError, HermesEvent } from "../../messages";

export type ChecksumDomainOptions = {
  errorBus: IHermesMessageBus<HermesError>;
  eventBus: IHermesMessageBus<HermesEvent>;
  logger: ILogger;
  registry: IHermesRegistry;
  store: IHermesChecksumStore;
};
