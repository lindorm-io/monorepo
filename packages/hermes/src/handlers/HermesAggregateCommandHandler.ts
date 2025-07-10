import { Constructor, Dict } from "@lindorm/types";
import { ZodSchema } from "zod";
import { IAggregateCommandHandler } from "../interfaces";
import {
  AggregateCommandCallback,
  AggregateCommandHandlerOptions,
  HandlerConditions,
  HandlerIdentifier,
} from "../types";
import { verifyIdentifierLength } from "../utils/private";

export class HermesAggregateCommandHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> implements IAggregateCommandHandler<C, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly command: string;
  public readonly conditions: HandlerConditions;
  public readonly encryption: boolean;
  public readonly key: string;
  public readonly schema: ZodSchema | undefined;
  public readonly handler: AggregateCommandCallback<C, S>;

  public constructor(options: AggregateCommandHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      namespace: options.aggregate.namespace,
    };
    this.key = options.key;
    this.command = options.command;
    this.conditions = options.conditions || {};
    this.encryption = options.encryption ?? false;
    this.schema = options.schema;
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
