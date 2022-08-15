import Joi from "joi";
import {
  IAggregateCommandHandler,
  AggregateCommandHandlerContext,
  AggregateCommandHandlerOptions,
  HandlerConditions,
  HandlerIdentifier,
  State,
  Data,
} from "../types";

export class AggregateCommandHandler<S extends State = State, D extends Data = Data>
  implements IAggregateCommandHandler<S, D>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly commandName: string;
  public readonly conditions: HandlerConditions;
  public readonly schema: Joi.Schema;
  public readonly handler: (ctx: AggregateCommandHandlerContext<S, D>) => Promise<void>;

  public constructor(options: AggregateCommandHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.commandName = options.commandName;
    this.conditions = options.conditions || {};
    this.schema = options.schema;
    this.handler = options.handler;
  }
}
