import { Logger } from "@lindorm-io/winston";
import { MessageBus, SagaStore } from "../infrastructure";
import { SagaEventHandler } from "../handler";

export interface ISagaDomain {
  registerEventHandler(eventHandler: SagaEventHandler): void;
}

export interface SagaDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: SagaStore;
}
