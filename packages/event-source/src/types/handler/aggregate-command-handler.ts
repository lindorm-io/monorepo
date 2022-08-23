import Joi from "joi";
import { ClassDTO, State } from "../generic";
import { HandlerConditions, HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateCommandHandlerContext<
  TCommand extends ClassDTO = ClassDTO,
  TEvent extends ClassDTO = ClassDTO,
  TState extends State = State,
> {
  command: TCommand;
  logger: ILogger;
  apply(event: TEvent): Promise<void>;
  getState(): TState;
}

export interface AggregateCommandHandler<
  TCommand extends ClassDTO,
  TEvent extends ClassDTO,
  TState extends State = State,
> {
  conditions?: HandlerConditions;
  schema?: Joi.Schema;
  version?: number;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<
  TCommand extends ClassDTO = ClassDTO,
  TEvent extends ClassDTO = ClassDTO,
  TState extends State = State,
> extends AggregateCommandHandler<TCommand, TEvent, TState> {
  aggregate: HandlerIdentifier;
  commandName: string;
}

export interface IAggregateCommandHandler<
  TCommand extends ClassDTO = ClassDTO,
  TEvent extends ClassDTO = ClassDTO,
  TState extends State = State,
> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;
  version: number;
  handler(ctx: AggregateCommandHandlerContext<TCommand, TEvent, TState>): Promise<void>;
}
