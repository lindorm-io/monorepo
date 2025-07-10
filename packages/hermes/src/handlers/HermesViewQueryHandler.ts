import { Constructor, Dict } from "@lindorm/types";
import { IViewQueryHandler } from "../interfaces";
import {
  HandlerIdentifier,
  ViewQueryCallback,
  ViewQueryHandlerOptions,
  ViewStoreSource,
} from "../types";

export class HermesViewQueryHandler<
  Q extends Constructor = Constructor,
  S extends Dict = Dict,
  R = any,
> implements IViewQueryHandler<Q, S, R>
{
  public readonly key: string;
  public readonly query: string;
  public readonly source: ViewStoreSource;
  public readonly view: HandlerIdentifier;
  public readonly handler: ViewQueryCallback<Q, S, R>;

  public constructor(options: ViewQueryHandlerOptions<Q, S, R>) {
    this.key = options.key;
    this.query = options.query;
    this.source = options.source;
    this.view = { name: options.view.name, context: options.view.context };
    this.handler = options.handler;
  }
}
