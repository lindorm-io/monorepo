import type { Constructor } from "@lindorm/types";
import type { z } from "zod";

// -- DTO class metadata --

export type MetaDtoKind = "command" | "event" | "timeout" | "query";

export type MetaDto = {
  kind: MetaDtoKind;
  name: string;
  version: number;
};

// -- Domain class metadata --

export type MetaAggregate = {
  name: string;
};

export type MetaSaga = {
  name: string;
  aggregates: Array<Constructor>;
};

export type MetaView = {
  name: string;
  aggregates: Array<Constructor>;
  entity: Constructor;
  driverType: string | null;
};

// -- Composable class metadata --

export type MetaForgettable = {
  forgettable: true;
};

// -- Handler method metadata --

export type HandlerKind =
  | "AggregateCommandHandler"
  | "AggregateEventHandler"
  | "AggregateErrorHandler"
  | "SagaEventHandler"
  | "SagaIdHandler"
  | "SagaTimeoutHandler"
  | "SagaErrorHandler"
  | "ViewEventHandler"
  | "ViewIdHandler"
  | "ViewQueryHandler"
  | "ViewErrorHandler";

export type MetaHandler = {
  kind: HandlerKind;
  methodName: string;
  trigger: Constructor;
};

// -- Composable method metadata --

export type MetaMethodModifier = {
  methodName: string;
  modifier: "requireCreated" | "requireNotCreated";
};

export type MetaValidation = {
  methodName: string;
  schema: z.ZodType;
};

export type MetaUpcaster = {
  from: Constructor;
  to: Constructor;
  method: string;
};

// -- Staged metadata shape --

export type StagedMetadata = {
  // Class-level singletons
  aggregate?: MetaAggregate;
  dto?: MetaDto;
  forgettable?: MetaForgettable;
  namespace?: string;
  saga?: MetaSaga;
  view?: MetaView;

  // Method-level arrays
  handlers?: Array<MetaHandler>;
  methodModifiers?: Array<MetaMethodModifier>;
  upcasters?: Array<MetaUpcaster>;
  validations?: Array<MetaValidation>;
};
