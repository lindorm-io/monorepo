import { Constructor, Dict } from "@lindorm/types";
import { IAggregateEventHandler } from "../interfaces";
import {
  AggregateEventCallback,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
} from "../types";
import { NameData, verifyIdentifierLength } from "../utils/private";

export class HermesAggregateEventHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> implements IAggregateEventHandler<C, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly event: NameData;
  public readonly key: string;
  public readonly handler: AggregateEventCallback<C, S>;

  public constructor(options: AggregateEventHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      context: options.aggregate.context,
    };
    this.event = options.event;
    this.key = options.key;
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
