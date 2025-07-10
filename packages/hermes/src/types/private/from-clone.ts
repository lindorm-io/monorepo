import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { HermesRegistry } from "../../classes/private";
import { AggregateDomain, ChecksumDomain, SagaDomain, ViewDomain } from "../../domains";
import { HermesStatus } from "../../enums";
import {
  ChecksumStore,
  EncryptionStore,
  EventStore,
  MessageBus,
  SagaStore,
  ViewStore,
} from "../../infrastructure";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../../messages";
import { HermesOptions } from "../hermes";

export type FromClone = {
  _mode: "from_clone";
  logger: ILogger;

  aggregateDomain: AggregateDomain;
  checksumDomain: ChecksumDomain;
  sagaDomain: SagaDomain;
  viewDomain: ViewDomain;

  checksumStore: ChecksumStore;
  encryptionStore: EncryptionStore;
  eventStore: EventStore;
  sagaStore: SagaStore;
  viewStore: ViewStore;

  commandBus: MessageBus<HermesCommand<Dict>>;
  errorBus: MessageBus<HermesError>;
  eventBus: MessageBus<HermesEvent<Dict>>;
  timeoutBus: MessageBus<HermesTimeout>;

  options: HermesOptions;
  registry: HermesRegistry;
  status: HermesStatus;

  namespace: string;
};
