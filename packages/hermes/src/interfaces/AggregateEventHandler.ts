import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { AggregateEventHandlerContext, HandlerIdentifier } from "../types";

export interface IAggregateEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  event: Constructor<E>;
  handler(ctx: AggregateEventHandlerContext<E, S>): Promise<void>;
}

export interface IHermesAggregateEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  eventName: string;
  version: number;
  handler(ctx: AggregateEventHandlerContext<E, S>): Promise<void>;
}
