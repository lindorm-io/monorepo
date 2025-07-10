import { ZodObject } from "zod";
import { HandlerConditions } from "../handlers";

// dtos

export type CommandDecoratorOptions = {
  aggregate?: { name: string; namespace: string };
  name?: string;
  version?: number;
};

export type EventDecoratorOptions = {
  name?: string;
  version?: number;
};

export type TimeoutDecoratorOptions = {
  name?: string;
  version?: number;
};

// models

export type AggregateDecoratorOptions = {
  encryption?: boolean;
  name?: string;
  namespace?: string;
};

export type SagaDecoratorOptions = {
  name?: string;
  namespace?: string;
};

export type ViewDecoratorOptions = {
  name?: string;
  namespace?: string;
};

// handlers

export type AggregateCommandHandlerDecoratorOptions = {
  conditions?: HandlerConditions;
  encryption?: boolean;
  schema?: ZodObject<any>;
};

export type SagaEventHandlerDecoratorOptions = {
  conditions?: HandlerConditions;
};

export type ViewEventHandlerDecoratorOptions = {
  conditions?: HandlerConditions;
};
