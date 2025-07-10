import { Constructor } from "@lindorm/types";
import { IViewIdHandler } from "../interfaces";
import { HandlerIdentifier, ViewIdCallback, ViewIdHandlerOptions } from "../types";
import { NameData } from "../utils/private";

export class HermesViewIdHandler<C extends Constructor> implements IViewIdHandler<C> {
  public readonly aggregate: HandlerIdentifier;
  public readonly event: NameData;
  public readonly key: string;
  public readonly view: HandlerIdentifier;
  public readonly handler: ViewIdCallback<C>;

  public constructor(options: ViewIdHandlerOptions<C>) {
    this.aggregate = {
      name: options.aggregate.name,
      namespace: options.aggregate.namespace,
    };
    this.event = options.event;
    this.key = options.key;
    this.view = {
      name: options.view.name,
      namespace: options.view.namespace,
    };
    this.handler = options.handler;
  }
}
