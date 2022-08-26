import { DtoClass, State } from "../generic";
import { HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateEventHandlerContext<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  event: TEvent;
  logger: ILogger;
  state: TState;
  destroy(): void;
  destroyNext(): void;
  mergeState(data: Partial<TState>): void;
  setState(state: TState): void;
}

export interface AggregateEventHandler<TEvent extends DtoClass, TState extends State = State> {
  version?: number;
  handler(ctx: AggregateEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface AggregateEventHandlerOptions<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> extends AggregateEventHandler<TEvent, TState> {
  aggregate: HandlerIdentifier;
  eventName: string;
}

export interface IAggregateEventHandler<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  aggregate: HandlerIdentifier;
  eventName: string;
  version: number;
  handler(ctx: AggregateEventHandlerContext<TEvent, TState>): Promise<void>;
}
