/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Constructor } from "@lindorm/types";
import { ZodObject } from "zod";
import { HandlerConditions } from "../handlers";
import { ViewStoreSource } from "../infrastructure";

export type MetaHandlerDecorator =
  | "AggregateCommandHandler"
  | "AggregateErrorHandler"
  | "AggregateEventHandler"
  | "SagaErrorHandler"
  | "SagaEventHandler"
  | "SagaIdHandler"
  | "SagaTimeoutHandler"
  | "ViewErrorHandler"
  | "ViewEventHandler"
  | "ViewIdHandler"
  | "ViewQueryHandler";

export type MetaAggregate = {
  encryption: boolean;
  name: string;
  namespace: string | null;
  target: Constructor;
};

export type MetaCommand = {
  aggregate: { name: string | null; namespace: string | null };
  name: string;
  target: Constructor;
  version: number;
};

export type MetaEvent = {
  name: string;
  target: Constructor;
  version: number;
};

export type MetaHandler<T = any> = {
  conditions: HandlerConditions | null;
  decorator: MetaHandlerDecorator;
  encryption: boolean;
  handler: T;
  key: string;
  schema: ZodObject<any> | null;
  target: Constructor;
  trigger: Constructor;
};

export type MetaQuery = {
  name: string;
  target: Constructor;
};

export type MetaSaga = {
  aggregates: Array<Constructor>;
  name: string;
  namespace: string | null;
  target: Constructor;
};

export type MetaTimeout = {
  name: string;
  target: Constructor;
  version: number;
};

export type MetaView = {
  aggregates: Array<Constructor>;
  name: string;
  namespace: string | null;
  source: ViewStoreSource;
  target: Constructor;
};

export type WithHandlers<T> = T & { handlers: Array<MetaHandler> };
