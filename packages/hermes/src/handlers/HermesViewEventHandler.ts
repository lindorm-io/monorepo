import { Constructor, Dict } from "@lindorm/types";
import { IViewEventHandler } from "../interfaces";
import {
  HandlerConditions,
  HandlerIdentifier,
  ViewEventCallback,
  ViewEventHandlerOptions,
  ViewStoreSource,
} from "../types";
import { NameData, verifyIdentifierLength, verifyViewIdentifier } from "../utils/private";

export class HermesViewEventHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> implements IViewEventHandler<C, S> {
  public readonly aggregate: HandlerIdentifier;
  public readonly conditions: HandlerConditions;
  public readonly event: NameData;
  public readonly key: string;
  public readonly source: ViewStoreSource;
  public readonly view: HandlerIdentifier;
  public readonly handler: ViewEventCallback<C, S>;

  public constructor(options: ViewEventHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      namespace: options.aggregate.namespace,
    };
    this.conditions = options.conditions || {};
    this.event = { name: options.event.name, version: options.event.version };
    this.key = options.key;
    this.source = options.source;
    this.view = { name: options.view.name, namespace: options.view.namespace };

    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
    verifyViewIdentifier(options.view);
  }
}
