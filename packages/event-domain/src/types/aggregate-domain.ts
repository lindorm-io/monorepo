import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { EventStore, MessageBus } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { AggregateIdentifier } from "./aggregate";
import { State } from "./generic";
import { Aggregate } from "../entity";

export interface IAggregateDomain {
  inspect<S extends State = State>(aggregateIdentifier: AggregateIdentifier): Promise<Aggregate<S>>;
  registerCommandHandler(handler: AggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: AggregateEventHandler): Promise<void>;
}

export interface AggregateDomainOptions {
  logger: Logger;
  messageBus: MessageBus;
  store: EventStore;
}
