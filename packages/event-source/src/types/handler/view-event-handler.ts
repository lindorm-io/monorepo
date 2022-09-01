import { Attributes, DtoClass, State } from "../generic";
import { DomainEvent } from "../../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { IViewStore, ViewStoreAdapterType } from "../view-store";
import { StoreIndexes } from "../store-index";

export interface ViewEventHandlerContext<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  event: TEvent;
  logger: ILogger;
  state: TState;
  destroy(): void;
  mergeState(data: Partial<TState>): void;
  setState(state: TState): void;
}

export interface ViewEventHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface ViewEventHandlerStoreOptions<TFields extends Attributes = Attributes> {
  custom?: IViewStore;
  indexes?: StoreIndexes<TFields>;
  type?: ViewStoreAdapterType;
}

export interface ViewEventHandler<TEvent extends DtoClass, TState extends State = State> {
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  name: string;
  options?: ViewEventHandlerStoreOptions;
  version?: number;
  getViewId?(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface ViewEventHandlerOptions<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  options?: ViewEventHandlerStoreOptions;
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
  options: ViewEventHandlerStoreOptions;
  version: number;
  view: HandlerIdentifier;
  getViewId(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}
