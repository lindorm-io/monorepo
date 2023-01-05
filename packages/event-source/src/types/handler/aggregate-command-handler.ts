import Joi from "joi";
import { Constructor, DtoClass, State } from "../generic";
import { HandlerConditions, HandlerIdentifier } from "./handler";
import { Logger } from "@lindorm-io/core-logger";

export interface AggregateCommandHandlerContext<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  command: TCommand;
  logger: Logger;
  state: TState;
  apply(event: TEvent): Promise<void>;
}

export interface AggregateCommandHandler<
  TCommand extends DtoClass,
  TEvent extends DtoClass,
  TState extends State = State,
> {
  command: Constructor<TCommand>;
  conditions?: HandlerConditions;
  schema?: Joi.Schema;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions?: HandlerConditions;
  schema?: Joi.Schema;
  version?: number;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}

export interface IAggregateCommandHandler<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;
  version: number;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}
