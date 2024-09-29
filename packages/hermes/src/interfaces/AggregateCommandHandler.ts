import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import {
  AggregateCommandHandlerContext,
  HandlerConditions,
  HandlerIdentifier,
} from "../types";

export interface IAggregateCommandHandler<
  C extends ClassLike = ClassLike,
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  command: Constructor<C>;
  conditions?: HandlerConditions;
  schema?: ZodSchema;
  handler(ctx: AggregateCommandHandlerContext<C, E, S>): Promise<void>;
}

export interface IHermesAggregateCommandHandler<
  C extends ClassLike = ClassLike,
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: ZodSchema | undefined;
  version: number;
  handler(ctx: AggregateCommandHandlerContext<C, E, S>): Promise<void>;
}
