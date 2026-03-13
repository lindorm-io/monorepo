import { ClassLike, Dict } from "@lindorm/types";
import { z } from "zod/v4";
import { AggregateCommandCtx, HandlerConditions, HandlerIdentifier } from "../types";

export interface IAggregateCommandHandler<
  C extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  command: string;
  conditions: HandlerConditions;
  encryption: boolean;
  schema: z.ZodType | undefined;
  handler(ctx: AggregateCommandCtx<C, S>): Promise<void>;
}
