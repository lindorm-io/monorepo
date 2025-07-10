import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import { HandlerIdentifier } from "../identifiers";
import { HandlerConditions } from "./conditions";

export type AggregateCommandCtx<C extends ClassLike, S extends Dict> = {
  command: C;
  logger: ILogger;
  meta: Dict;
  state: S;
  apply(event: ClassLike): Promise<void>;
};

export type AggregateCommandHandlerOptions<C extends ClassLike, S extends Dict> = {
  aggregate: HandlerIdentifier;
  command: string;
  conditions?: HandlerConditions;
  encryption?: boolean;
  key: string;
  schema?: ZodSchema;
  handler(ctx: AggregateCommandCtx<C, S>): Promise<void>;
};
