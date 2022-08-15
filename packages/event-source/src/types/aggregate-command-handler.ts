import Joi from "joi";
import { Command } from "../message";
import { Data, State } from "./generic";
import { HandlerConditions, HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateCommandHandlerContext<S extends State = State, D extends Data = Data> {
  command: Command<D>;
  logger: ILogger;

  apply(name: string, data?: Record<string, any>): Promise<void>;
  getState(): S;
}

export interface AggregateCommandHandlerFile<S extends State = State, D extends Data = Data> {
  conditions?: HandlerConditions;
  schema: Joi.Schema;
  handler(ctx: AggregateCommandHandlerContext<S, D>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<S extends State = State>
  extends AggregateCommandHandlerFile<S> {
  aggregate: HandlerIdentifier;
  commandName: string;
}

export interface IAggregateCommandHandler<S extends State = State, D extends Data = Data> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;

  handler(ctx: AggregateCommandHandlerContext<S, D>): Promise<void>;
}
