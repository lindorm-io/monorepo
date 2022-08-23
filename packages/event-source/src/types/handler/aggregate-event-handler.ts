import { ClassConstructor, State } from "../generic";
import { HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateEventHandlerContext<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> {
  event: TEvent;
  logger: ILogger;
  destroy(): void;
  destroyNext(): void;
  getState(): TState;
  mergeState(data: Partial<TState>): void;
  setState(path: string, value: any): void;
}

export interface AggregateEventHandler<
  TEvent extends ClassConstructor,
  TState extends State = State,
> {
  version?: number;
  handler(ctx: AggregateEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface AggregateEventHandlerOptions<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> extends AggregateEventHandler<TEvent, TState> {
  aggregate: HandlerIdentifier;
  eventName: string;
}

export interface IAggregateEventHandler<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> {
  aggregate: HandlerIdentifier;
  eventName: string;
  version: number;
  handler(ctx: AggregateEventHandlerContext<TEvent, TState>): Promise<void>;
}
