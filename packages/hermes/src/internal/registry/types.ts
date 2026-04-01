import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import type { HermesViewEntity } from "../../entities/HermesViewEntity";
import type { HandlerKind, MetaDtoKind } from "#internal/metadata";

// -- Scanner input --

export type HermesScannerInput = Array<Constructor | string>;

// -- Handler conditions --

export type HandlerConditions = {
  requireCreated?: boolean;
  requireNotCreated?: boolean;
};

// -- Handler registration --

export type HandlerRegistration = {
  kind: HandlerKind;
  methodName: string;
  trigger: Constructor;
  conditions: HandlerConditions;
  schema: z.ZodType | null;
};

// -- DTO registrations --

export type RegisteredDto = {
  kind: MetaDtoKind;
  name: string;
  version: number;
  target: Constructor;
};

// -- Upcaster registration --

export type RegisteredUpcaster = {
  fromName: string;
  fromVersion: number;
  toVersion: number;
  method: string;
  from: Constructor;
  to: Constructor;
};

// -- Domain registrations --

export type RegisteredAggregate = {
  name: string;
  namespace: string;
  forgettable: boolean;
  target: Constructor;
  commandHandlers: Array<HandlerRegistration>;
  eventHandlers: Array<HandlerRegistration>;
  errorHandlers: Array<HandlerRegistration>;
  upcasters: Array<RegisteredUpcaster>;
};

export type RegisteredSaga = {
  name: string;
  namespace: string;
  aggregates: Array<{ name: string; namespace: string }>;
  target: Constructor;
  eventHandlers: Array<HandlerRegistration>;
  idHandlers: Array<HandlerRegistration>;
  timeoutHandlers: Array<HandlerRegistration>;
  errorHandlers: Array<HandlerRegistration>;
};

export type RegisteredView = {
  name: string;
  namespace: string;
  aggregates: Array<{ name: string; namespace: string }>;
  entity: Constructor<HermesViewEntity>;
  driverType: string | null;
  target: Constructor;
  eventHandlers: Array<HandlerRegistration>;
  idHandlers: Array<HandlerRegistration>;
  queryHandlers: Array<HandlerRegistration>;
  errorHandlers: Array<HandlerRegistration>;
};

// -- Scanned modules --

export type ScannedModules = {
  commands: Array<RegisteredDto>;
  events: Array<RegisteredDto>;
  queries: Array<RegisteredDto>;
  timeouts: Array<RegisteredDto>;
  aggregates: Array<RegisteredAggregate>;
  sagas: Array<RegisteredSaga>;
  views: Array<RegisteredView>;
};
