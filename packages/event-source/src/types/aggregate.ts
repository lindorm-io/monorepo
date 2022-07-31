import { AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { StandardIdentifier } from "./standard-identifier";

export type AggregateIdentifier = StandardIdentifier;

export interface AggregateData extends AggregateIdentifier {
  destroyed: boolean;
  events: Array<DomainEvent>;
  numberOfLoadedEvents: number;
  state: Record<string, any>;
}

export interface AggregateOptions extends AggregateIdentifier {
  eventHandlers: Array<AggregateEventHandler>;
}

export interface IAggregate extends AggregateData {
  apply(causation: Command, name: string, data?: Record<string, any>): Promise<void>;
  load(event: DomainEvent): void;
  toJSON(): AggregateData;
}
