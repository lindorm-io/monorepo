import { Aggregate } from "../../entity";
import { AggregateIdentifier } from "../entity";
import { IAggregateCommandHandler, IAggregateEventHandler } from "../handler";
import { IDomainEventStore } from "../event-store";
import { IMessageBus } from "@lindorm-io/amqp";
import { State } from "../generic";

export interface AggregateDomainOptions {
  messageBus: IMessageBus;
  store: IDomainEventStore;
}

export interface IAggregateDomain {
  registerCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: IAggregateEventHandler): Promise<void>;

  removeCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  removeEventHandler(handler: IAggregateEventHandler): Promise<void>;

  removeAllCommandHandlers(): Promise<void>;
  removeAllEventHandlers(): Promise<void>;

  inspect<TState extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>>;
}
