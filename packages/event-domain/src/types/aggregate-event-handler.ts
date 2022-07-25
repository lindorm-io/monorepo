import { DomainEvent } from "../message";
import { HandlerIdentifier } from "./handler";
import { Logger } from "@lindorm-io/winston";
import { State } from "./generic";

export interface AggregateEventHandlerContext<S extends State = State> {
  event: DomainEvent;
  logger: Logger;

  destroy(): void;
  destroyNext(): void;
  getState(): S;
  mergeState(data: Partial<S>): void;
  setState(path: string, value: any): void;
}

export interface AggregateEventHandlerFile<S extends State = State> {
  handler(ctx: AggregateEventHandlerContext<S>): Promise<void>;
}

export interface AggregateEventHandlerOptions<S extends State = State>
  extends AggregateEventHandlerFile<S> {
  aggregate: HandlerIdentifier;
  eventName: string;
}

export interface IAggregateEventHandler<S extends State = State> {
  aggregate: HandlerIdentifier;
  eventName: string;
  handler(ctx: AggregateEventHandlerContext<S>): Promise<void>;
}
