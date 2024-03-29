import { AggregateEventHandlerImplementation } from "../../handler";
import { DtoClass } from "../generic";
import { Command, DomainEvent } from "../../message";
import { StandardIdentifier } from "../standard-identifier";

export type AggregateIdentifier = StandardIdentifier;

export interface AggregateData extends AggregateIdentifier {
  destroyed: boolean;
  events: Array<DomainEvent>;
  numberOfLoadedEvents: number;
  state: Record<string, any>;
}

export interface AggregateOptions extends AggregateIdentifier {
  eventHandlers: Array<AggregateEventHandlerImplementation>;
}

export interface IAggregate extends AggregateData {
  apply(causation: Command, event: DtoClass): Promise<void>;
  load(event: DomainEvent): void;
  toJSON(): AggregateData;
}
