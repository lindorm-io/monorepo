import { DomainEvent } from "../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { Logger } from "@lindorm-io/winston";
import { State } from "./generic";
import { ViewStoreDocumentOptions } from "./view-store";

export type GetViewIdFunction = (event: DomainEvent) => string;

export interface ViewEventHandlerContext<S extends State = State> {
  event: DomainEvent;
  logger: Logger;

  addField(path: string, value: any): void;
  destroy(): void;
  getState(): S;
  removeFieldWhereEqual(path: string, value: any): void;
  removeFieldWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: any): void;
}

export interface ViewEventHandlerFile<S extends State = State> {
  conditions?: HandlerConditions;
  context?: Array<string> | string;
  documentOptions?: ViewStoreDocumentOptions;
  getViewId: GetViewIdFunction;
  handler(ctx: ViewEventHandlerContext<S>): Promise<void>;
}

export interface ViewEventHandlerOptions<S extends State = State> extends ViewEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  view: HandlerIdentifier;
}

export interface IViewEventHandler<S extends State = State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  documentOptions: ViewStoreDocumentOptions;
  eventName: string;
  getViewId: GetViewIdFunction;
  view: HandlerIdentifier;
  handler(ctx: ViewEventHandlerContext<S>): Promise<void>;
}
