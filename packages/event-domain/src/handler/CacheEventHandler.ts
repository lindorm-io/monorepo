import {
  CacheEventHandlerContext,
  CacheEventHandlerOptions,
  GetCacheIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ICacheEventHandler,
  State,
} from "../types";

export class CacheEventHandler<S extends State = State> implements ICacheEventHandler<S> {
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly cache: HandlerIdentifier;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly getCacheId: GetCacheIdFunction;
  public readonly handler: (ctx: CacheEventHandlerContext<S>) => Promise<void>;

  public constructor(options: CacheEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.cache = { name: options.cache.name, context: options.cache.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.getCacheId = options.getCacheId;
    this.handler = options.handler;
  }
}
