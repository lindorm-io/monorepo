import Joi from "joi";
import {
  IAggregateCommandHandler,
  AggregateCommandHandlerContext,
  AggregateCommandHandlerOptions,
  HandlerConditions,
  HandlerIdentifier,
} from "../types";

export class AggregateCommandHandler<State extends Record<string, any> = Record<string, any>>
  implements IAggregateCommandHandler<State>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly commandName: string;
  public readonly conditions: HandlerConditions;
  public readonly schema: Joi.Schema;
  public readonly handler: (ctx: AggregateCommandHandlerContext<State>) => Promise<void>;

  public constructor(options: AggregateCommandHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.commandName = options.commandName;
    this.conditions = options.conditions || {};
    this.schema = options.schema;
    this.handler = options.handler;
  }
}
