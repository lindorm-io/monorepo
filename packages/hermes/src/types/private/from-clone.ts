import { ILogger } from "@lindorm/logger";
import { HermesScanner } from "../../classes/private";
import { HermesStatus } from "../../enums";
import {
  IAggregateDomain,
  IChecksumDomain,
  IErrorDomain,
  IEventStore,
  IHermesChecksumStore,
  IHermesEncryptionStore,
  IHermesMessageBus,
  IHermesSagaStore,
  IHermesViewStore,
  IQueryDomain,
  ISagaDomain,
  IViewDomain,
} from "../../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../../messages";
import { ViewEventHandlerAdapter } from "../handlers";
import { HermesConfig } from "../hermes";
import { HandlerIdentifier } from "../identifiers";

export type FromClone = {
  _mode: "from_clone";
  logger: ILogger;

  aggregateDomain: IAggregateDomain;
  checksumDomain: IChecksumDomain;
  errorDomain: IErrorDomain;
  queryDomain: IQueryDomain;
  sagaDomain: ISagaDomain;
  viewDomain: IViewDomain;

  checksumStore: IHermesChecksumStore;
  encryptionStore: IHermesEncryptionStore;
  eventStore: IEventStore;
  sagaStore: IHermesSagaStore;
  viewStore: IHermesViewStore;

  commandBus: IHermesMessageBus<HermesCommand>;
  errorBus: IHermesMessageBus<HermesError>;
  eventBus: IHermesMessageBus<HermesEvent>;
  timeoutBus: IHermesMessageBus<HermesTimeout>;

  scanner: HermesScanner;
  options: HermesConfig;
  adapters: Array<HandlerIdentifier & ViewEventHandlerAdapter>;

  status: HermesStatus;
};
