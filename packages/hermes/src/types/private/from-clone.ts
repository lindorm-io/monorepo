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
  messageBus: IHermesMessageBus;
  sagaStore: IHermesSagaStore;
  viewStore: IHermesViewStore;

  scanner: HermesScanner;
  options: HermesConfig;
  adapters: Array<HandlerIdentifier & ViewEventHandlerAdapter>;

  status: HermesStatus;
};
