import Joi from "joi";
import { DtoClass, State } from "../generic";
import { HandlerConditions, HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateCommandHandlerContext<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> {
  command: TCommand;
  logger: ILogger;
  apply(event: TEvent): Promise<void>;
  getState(): TState;
}

export interface AggregateCommandHandler<
  TCommand extends DtoClass,
  TEvent extends DtoClass,
  TState extends State = State,
> {
  conditions?: HandlerConditions;
  schema?: Joi.Schema;
  version?: number;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<
  TCommand extends DtoClass = DtoClass,
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> extends AggregateCommandHandler<TCommand, TEvent, TState> {
  aggregate: HandlerIdentifier;
  commandName: string;
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
