import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { EventStore, MessageBus } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { AggregateIdentifier } from "./aggregate";
import { State } from "./generic";
import { Aggregate } from "../entity";

export interface AggregateDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: EventStore;
}

export interface IAggregateDomain {
  registerCommandHandler(handler: AggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: AggregateEventHandler): Promise<void>;
  removeCommandHandler(handler: AggregateCommandHandler): Promise<void>;
  removeEventHandler(handler: AggregateEventHandler): Promise<void>;
  removeAllCommandHandlers(): Promise<void>;
  removeAllEventHandlers(): Promise<void>;
  inspect<S extends State = State>(aggregateIdentifier: AggregateIdentifier): Promise<Aggregate<S>>;
}
