import { snakeCase } from "@lindorm/case";
import { ClassLike, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import { IHermesAggregateCommandHandler } from "../interfaces";
import {
  AggregateCommandHandlerContext,
  AggregateCommandHandlerOptions,
  HandlerConditions,
  HandlerIdentifier,
} from "../types";

export class HermesAggregateCommandHandler<
  C extends ClassLike = ClassLike,
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> implements IHermesAggregateCommandHandler<C, E, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly commandName: string;
  public readonly conditions: HandlerConditions;
  public readonly encryption: boolean;
  public readonly schema: ZodSchema | undefined;
  public readonly version: number;
  public readonly handler: (
    ctx: AggregateCommandHandlerContext<C, E, S>,
  ) => Promise<void>;

  public constructor(options: AggregateCommandHandlerOptions<C, E, S>) {
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: snakeCase(options.aggregate.context),
    };
    this.commandName = snakeCase(options.commandName);
    this.conditions = options.conditions || {};
    this.encryption = options.encryption ?? false;
    this.schema = options.schema;
    this.version = options.version || 1;
    this.handler = options.handler;
  }
}
