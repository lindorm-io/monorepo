import { Data, State } from "./generic";
import { DomainEvent } from "../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { ViewStoreHandlerOptions } from "./view-store";

export type GetViewIdFunction = (event: DomainEvent) => string;

export interface ViewEventHandlerContext<S extends State = State, D extends Data = Data> {
  event: DomainEvent<D>;
  logger: ILogger;

  addField(path: string, value: any): void;
  destroy(): void;
  getState(): S;
  removeFieldWhereEqual(path: string, value: any): void;
  removeFieldWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: any): void;
}

export interface ViewEventHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface ViewEventHandlerFile<S extends State = State, D extends Data = Data> {
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  persistence: ViewStoreHandlerOptions;
  getViewId: GetViewIdFunction;
  handler(ctx: ViewEventHandlerContext<S, D>): Promise<void>;
}

export interface ViewEventHandlerOptions<S extends State = State> extends ViewEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  view: HandlerIdentifier;
}

export interface IViewEventHandler<S extends State = State, D extends Data = Data> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  persistence: ViewStoreHandlerOptions;
  view: HandlerIdentifier;
  getViewId: GetViewIdFunction;
  handler(ctx: ViewEventHandlerContext<S, D>): Promise<void>;
}
