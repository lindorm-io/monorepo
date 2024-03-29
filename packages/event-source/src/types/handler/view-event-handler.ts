import { Logger } from "@lindorm-io/core-logger";
import { DomainEvent } from "../../message";
import { Attributes, Constructor, DtoClass, State } from "../generic";
import { StoreIndexes } from "../store-index";
import { IViewStore, ViewStoreAdapterType } from "../view-store";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";

export interface ViewEventHandlerContext<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  event: TEvent;
  logger: Logger;
  state: TState;
  destroy(): void;
  mergeState(data: Partial<TState>): void;
  setState(state: TState): void;
}

export interface ViewEventHandlerFileAggregate {
  name?: string;
  context?: Array<string> | string;
}

export interface ViewEventHandlerAdapter<TFields extends Attributes = Attributes> {
  custom?: IViewStore;
  indexes?: StoreIndexes<TFields>;
  type: ViewStoreAdapterType;
}

export interface ViewEventHandler<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  event: Constructor<TEvent>;
  adapter: ViewEventHandlerAdapter;
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  getViewId?(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface ViewEventHandlerOptions<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  adapter: ViewEventHandlerAdapter;
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  version?: number;
  view: HandlerIdentifier;
  getViewId?(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface IViewEventHandler<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  adapter: ViewEventHandlerAdapter;
  version: number;
  view: HandlerIdentifier;
  getViewId(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}
