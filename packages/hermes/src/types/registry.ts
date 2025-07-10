import { Constructor } from "@lindorm/types";
import { HandlerIdentifier } from "./identifiers";
import { ViewStoreSource } from "./infrastructure";

export type RegistryCommand = {
  aggregate: HandlerIdentifier;
  name: string;
  target: Constructor;
};

export type RegistryEvent = {
  aggregate: HandlerIdentifier;
  name: string;
  target: Constructor;
  version: number;
};

export type RegistryQuery = {
  name: string;
  target: Constructor;
  view: HandlerIdentifier;
};

export type RegistryTimeout = {
  aggregate: HandlerIdentifier;
  name: string;
  saga: HandlerIdentifier;
  target: Constructor;
};

export type RegistryAggregate = {
  encryption: boolean;
  name: string;
  namespace: string;
  target: Constructor;
};

export type RegistrySaga = {
  aggregates: Array<HandlerIdentifier>;
  name: string;
  namespace: string;
  target: Constructor;
};

export type RegistryView = {
  aggregates: Array<HandlerIdentifier>;
  name: string;
  namespace: string;
  source: ViewStoreSource;
  target: Constructor;
};

export type HermesRegistryOptions = {
  namespace?: string;
};
