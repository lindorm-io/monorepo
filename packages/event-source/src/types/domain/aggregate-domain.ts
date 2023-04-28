import { IMessageBus } from "@lindorm-io/amqp";
import { Aggregate } from "../../model";
import { IDomainEventStore } from "../event-store";
import { State } from "../generic";
import { IAggregateCommandHandler, IAggregateEventHandler } from "../handler";
import { AggregateIdentifier } from "../model";

export type AggregateDomainOptions = {
  messageBus: IMessageBus;
  store: IDomainEventStore;
};

export interface IAggregateDomain {
  registerCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: IAggregateEventHandler): Promise<void>;
  resubscribeCommandHandlers(): Promise<void>;
  unsubscribeCommandHandlers(): Promise<void>;
  inspect<TState extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>>;
}
