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
  // on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerCommandHandler(handler: IAggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: IAggregateEventHandler): Promise<void>;
  resubscribeCommandHandlers(): Promise<void>;
  unsubscribeCommandHandlers(): Promise<void>;
  inspect<TState extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>>;
}
