import { ClassLike, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import { AggregateCommandCtx, HandlerConditions, HandlerIdentifier } from "../types";

export interface IAggregateCommandHandler<
  C extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  command: string;
  conditions: HandlerConditions;
  encryption: boolean;
  schema: ZodSchema | undefined;
  handler(ctx: AggregateCommandCtx<C, S>): Promise<void>;
}
