import { snakeCase } from "@lindorm/case";
import { ClassLike, Dict } from "@lindorm/types";
import { IHermesAggregateEventHandler } from "../interfaces";
import {
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
} from "../types";
import { verifyIdentifierLength } from "../utils/private";

export class HermesAggregateEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> implements IHermesAggregateEventHandler<E, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;
  public readonly version: number;
  public readonly handler: (ctx: AggregateEventHandlerContext<E, S>) => Promise<void>;

  public constructor(options: AggregateEventHandlerOptions<E, S>) {
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: snakeCase(options.aggregate.context),
    };
    this.eventName = snakeCase(options.eventName);
    this.version = options.version || 1;
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
