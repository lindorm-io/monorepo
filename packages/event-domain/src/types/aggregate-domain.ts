import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { EventStore, MessageBus } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";

export interface IAggregateDomain {
  registerCommandHandler(handler: AggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: AggregateEventHandler): Promise<void>;
}

export interface AggregateDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: EventStore;
}
