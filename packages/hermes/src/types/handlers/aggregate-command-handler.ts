import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import { HandlerIdentifier } from "../identifiers";
import { HandlerConditions } from "./handler";

export type AggregateCommandHandlerContext<
  C extends ClassLike = ClassLike,
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  command: C;
  logger: ILogger;
  state: S;
  apply(event: E): Promise<void>;
};

export type AggregateCommandHandlerOptions<
  C extends ClassLike = ClassLike,
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> = {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions?: HandlerConditions;
  schema?: ZodSchema;
  version?: number;
  handler(ctx: AggregateCommandHandlerContext<C, E, S>): Promise<void>;
};
