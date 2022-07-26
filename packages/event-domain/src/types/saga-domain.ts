import { Logger } from "@lindorm-io/winston";
import { MessageBus, SagaStore } from "../infrastructure";
import { SagaEventHandler } from "../handler";

export interface SagaDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: SagaStore;
}

export interface ISagaDomain {
  registerEventHandler(eventHandler: SagaEventHandler): Promise<void>;
  removeEventHandler(eventHandler: SagaEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;
}
