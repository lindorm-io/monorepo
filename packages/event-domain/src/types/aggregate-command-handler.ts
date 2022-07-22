import Joi from "joi";
import { Command } from "../message";
import { Logger } from "@lindorm-io/winston";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
} from "./handler";

export interface AggregateCommandHandlerContext<
  State extends Record<string, any> = Record<string, any>,
> {
  command: Command;
  state: State;
  logger: Logger;

  apply(name: string, data?: Record<string, any>): Promise<void>;
}

export interface AggregateCommandHandlerFile<
  State extends Record<string, any> = Record<string, any>,
> {
  conditions?: HandlerConditions;
  schema: Joi.Schema;
  handler(ctx: AggregateCommandHandlerContext<State>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<
  State extends Record<string, any> = Record<string, any>,
> extends AggregateCommandHandlerFile<State> {
  aggregate: HandlerIdentifierExpectingStructure;
  commandName: string;
}

export interface IAggregateCommandHandler<State extends Record<string, any> = Record<string, any>> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;

  handler(ctx: AggregateCommandHandlerContext<State>): Promise<void>;
}
