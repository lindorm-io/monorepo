import { Data, State } from "../generic";
import { DomainEvent } from "../../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import {
  MongoViewEventHandlerAdapterOptions,
  PostgresViewEventHandlerAdapterOptions,
  ViewStoreAdapterType,
} from "../view-store";

export type GetViewIdFunction = (event: DomainEvent) => string;

export interface ViewEventHandlerContext<S extends State = State, D extends Data = Data> {
  event: DomainEvent<D>;
  logger: ILogger;
  addListItem(path: string, value: any): void;
  destroy(): void;
  getState(): S;
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
  type?: ViewStoreAdapterType;
}

export interface ViewEventHandlerFile<S extends State = State, D extends Data = Data> {
  adapters: ViewEventHandlerAdapters;
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  version?: number;
  getViewId?(event: DomainEvent): string;
  handler(ctx: ViewEventHandlerContext<S, D>): Promise<void>;
}

export interface ViewEventHandlerOptions<S extends State = State> extends ViewEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  view: HandlerIdentifier;
}

export interface IViewEventHandler<S extends State = State, D extends Data = Data> {
  adapters: ViewEventHandlerAdapters;
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  version: number;
  view: HandlerIdentifier;
  getViewId(event: DomainEvent): string;
  handler(ctx: ViewEventHandlerContext<S, D>): Promise<void>;
}
