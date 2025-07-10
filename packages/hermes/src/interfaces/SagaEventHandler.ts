import { ClassLike, Dict } from "@lindorm/types";
import { HandlerConditions, HandlerIdentifier, SagaEventCtx } from "../types";
import { NameData } from "../utils/private";

export interface ISagaEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  conditions: HandlerConditions;
  event: NameData;
  saga: HandlerIdentifier;
  handler(ctx: SagaEventCtx<E, S>): Promise<void>;
}
