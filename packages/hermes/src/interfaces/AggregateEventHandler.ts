import { ClassLike, Dict } from "@lindorm/types";
import { AggregateEventCtx, HandlerIdentifier } from "../types";
import { NameData } from "../utils/private";

export interface IAggregateEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  event: NameData;
  handler(ctx: AggregateEventCtx<E, S>): Promise<void>;
}
