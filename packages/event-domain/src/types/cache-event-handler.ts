import { DomainEvent } from "../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { Logger } from "@lindorm-io/winston";
import { State } from "./generic";

export type GetCacheIdFunction = (event: DomainEvent) => string;

export interface CacheEventHandlerContext<S extends State = State> {
  event: DomainEvent;
  logger: Logger;

  addField(path: string, value: any): void;
  destroy(): void;
  getState(): S;
  removeFieldWhereEqual(path: string, value: any): void;
  removeFieldWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: any): void;
}

export interface CacheEventHandlerFile<S extends State = State> {
  conditions?: HandlerConditions;
  context?: Array<string> | string;
  getCacheId: GetCacheIdFunction;
  handler(ctx: CacheEventHandlerContext<S>): Promise<void>;
}

export interface CacheEventHandlerOptions<S extends State = State>
  extends CacheEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  cache: HandlerIdentifier;
}

export interface ICacheEventHandler<S extends State = State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  getCacheId: GetCacheIdFunction;
  cache: HandlerIdentifier;
  handler(ctx: CacheEventHandlerContext<S>): Promise<void>;
}
