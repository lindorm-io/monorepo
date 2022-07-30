import Joi from "joi";
import { Command } from "../message";
import { HandlerConditions, HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { State } from "./generic";

export interface AggregateCommandHandlerContext<S extends State = State> {
  command: Command;
  logger: ILogger;

  apply(name: string, data?: Record<string, any>): Promise<void>;
  getState(): S;
}

export interface AggregateCommandHandlerFile<S extends State = State> {
  conditions?: HandlerConditions;
  schema: Joi.Schema;
  handler(ctx: AggregateCommandHandlerContext<S>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<S extends State = State>
  extends AggregateCommandHandlerFile<S> {
  aggregate: HandlerIdentifier;
  commandName: string;
}

export interface IAggregateCommandHandler<S extends State = State> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;

  handler(ctx: AggregateCommandHandlerContext<S>): Promise<void>;
}
