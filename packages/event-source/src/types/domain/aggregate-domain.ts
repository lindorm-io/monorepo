import { Aggregate } from "../../model";
import { AggregateIdentifier } from "../model";
import { State } from "../generic";
import { IAggregateCommandHandler, IAggregateEventHandler } from "../handler";
import { IDomainEventStore } from "../event-store";
import { IMessageBus } from "@lindorm-io/amqp";

export interface AggregateDomainOptions {
  messageBus: IMessageBus;
  store: IDomainEventStore;
}

export interface IAggregateDomain {
  registerCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: IAggregateEventHandler): Promise<void>;
  resubscribeCommandHandlers(): Promise<void>;
  unsubscribeCommandHandlers(): Promise<void>;
  inspect<TState extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>>;
}
