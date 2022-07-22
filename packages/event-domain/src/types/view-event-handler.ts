import { DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { ViewStoreDocumentOptions } from "./view-store";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
  HandlerIdentifierMultipleContexts,
} from "./handler";

export type GetViewIdFunction = (event: DomainEvent) => string;

export interface ViewEventHandlerContext<State extends Record<string, any> = Record<string, any>> {
  event: DomainEvent;
  state: State;
  logger: Logger;
  addField(path: string, value: any): void;
  destroy(): void;
  removeFieldWhereEqual(path: string, value: any): void;
  removeFieldWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: any): void;
}

export interface ViewEventHandlerFile<State extends Record<string, any> = Record<string, any>> {
  conditions?: HandlerConditions;
  context?: Array<string> | string;
  documentOptions?: ViewStoreDocumentOptions;
  getViewId: GetViewIdFunction;
  handler(ctx: ViewEventHandlerContext<State>): Promise<void>;
}

export interface ViewEventHandlerOptions<State extends Record<string, any> = Record<string, any>>
  extends ViewEventHandlerFile<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  view: HandlerIdentifierExpectingStructure;
}

export interface IViewEventHandler<State extends Record<string, any> = Record<string, any>> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  documentOptions: ViewStoreDocumentOptions;
  eventName: string;
  getViewId: GetViewIdFunction;
  view: HandlerIdentifier;
  handler(ctx: ViewEventHandlerContext<State>): Promise<void>;
}
