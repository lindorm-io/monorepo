import { ClassConstructor, State } from "../generic";
import { DomainEvent } from "../../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import {
  MongoViewEventHandlerAdapterOptions,
  PostgresViewEventHandlerAdapterOptions,
} from "../view-store";

export type GetViewIdFunction<TEvent extends ClassConstructor = ClassConstructor> = (
  event: DomainEvent<TEvent>,
) => string;

export interface ViewEventHandlerContext<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> {
  event: TEvent;
  logger: ILogger;
  addListItem(path: string, value: any): void;
  destroy(): void;
  getState(): TState;
  removeListItemWhereEqual(path: string, value: any): void;
  removeListItemWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: any): void;
}

export interface ViewEventHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface ViewEventHandlerAdapters {
  custom?: Record<string, any>;
  mongo?: MongoViewEventHandlerAdapterOptions;
  postgres?: PostgresViewEventHandlerAdapterOptions;
}

export interface ViewEventHandler<TEvent extends ClassConstructor, TState extends State = State> {
  name: string;
  adapters?: ViewEventHandlerAdapters;
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  version?: number;
  getViewId?(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface ViewEventHandlerOptions<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> {
  adapters: ViewEventHandlerAdapters;
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  version?: number;
  view: HandlerIdentifier;
  getViewId?(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}

export interface IViewEventHandler<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
> {
  adapters: ViewEventHandlerAdapters;
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  version: number;
  view: HandlerIdentifier;
  getViewId(event: DomainEvent<TEvent>): string;
  handler(ctx: ViewEventHandlerContext<TEvent, TState>): Promise<void>;
}
