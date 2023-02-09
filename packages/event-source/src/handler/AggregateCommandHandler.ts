import Joi from "joi";
import {
  AggregateCommandHandlerContext,
  AggregateCommandHandlerOptions,
  DtoClass,
  HandlerConditions,
  HandlerIdentifier,
  IAggregateCommandHandler,
  State,
} from "../types";

export class AggregateCommandHandlerImplementation<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> implements IAggregateCommandHandler<TCommand, TEvent, TState>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly commandName: string;
  public readonly conditions: HandlerConditions;
  public readonly schema: Joi.Schema | undefined;
  public readonly version: number;
  public readonly handler: (
    ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>,
  ) => Promise<void>;

  public constructor(options: AggregateCommandHandlerOptions<TCommand, TEvent, TState>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.commandName = options.commandName;
    this.conditions = options.conditions || {};
    this.schema = options.schema;
    this.version = options.version || 1;
    this.handler = options.handler;
  }
}
