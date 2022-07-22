import { DomainEvent } from "../message";
import { HandlerIdentifier, HandlerIdentifierExpectingStructure } from "./handler";
import { Logger } from "@lindorm-io/winston";

export interface AggregateEventHandlerContext<
  State extends Record<string, any> = Record<string, any>,
> {
  event: DomainEvent;
  logger: Logger;
  state: State;

  destroy(): void;
  destroyNext(): void;
  mergeState(data: Partial<State>): void;
  setState(path: string, value: any): void;
}

export interface AggregateEventHandlerFile<
  State extends Record<string, any> = Record<string, any>,
> {
  handler(ctx: AggregateEventHandlerContext<State>): Promise<void>;
}

export interface AggregateEventHandlerOptions<
  State extends Record<string, any> = Record<string, any>,
> extends AggregateEventHandlerFile<State> {
  aggregate: HandlerIdentifierExpectingStructure;
  eventName: string;
}

export interface IAggregateEventHandler<State extends Record<string, any> = Record<string, any>> {
  aggregate: HandlerIdentifier;
  eventName: string;
  handler(ctx: AggregateEventHandlerContext<State>): Promise<void>;
}
