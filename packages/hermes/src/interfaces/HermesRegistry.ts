import { Constructor } from "@lindorm/types";
import {
  IAggregateCommandHandler,
  IAggregateErrorHandler,
  IAggregateEventHandler,
  ISagaErrorHandler,
  ISagaEventHandler,
  ISagaIdHandler,
  ISagaTimeoutHandler,
  IViewErrorHandler,
  IViewEventHandler,
  IViewIdHandler,
  IViewQueryHandler,
} from "../interfaces";
import {
  HermesScannerInput,
  RegistryAggregate,
  RegistryCommand,
  RegistryEvent,
  RegistryQuery,
  RegistrySaga,
  RegistryTimeout,
  RegistryView,
} from "../types";

export interface IHermesRegistry {
  commands: Array<RegistryCommand>;
  events: Array<RegistryEvent>;
  queries: Array<RegistryQuery>;
  timeouts: Array<RegistryTimeout>;
  aggregates: Array<RegistryAggregate>;
  sagas: Array<RegistrySaga>;
  views: Array<RegistryView>;
  aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  aggregateErrorHandlers: Array<IAggregateErrorHandler>;
  aggregateEventHandlers: Array<IAggregateEventHandler>;
  sagaErrorHandlers: Array<ISagaErrorHandler>;
  sagaEventHandlers: Array<ISagaEventHandler>;
  sagaIdHandlers: Array<ISagaIdHandler>;
  sagaTimeoutHandlers: Array<ISagaTimeoutHandler>;
  viewErrorHandlers: Array<IViewErrorHandler>;
  viewEventHandlers: Array<IViewEventHandler>;
  viewIdHandlers: Array<IViewIdHandler>;
  viewQueryHandlers: Array<IViewQueryHandler>;

  add(input: HermesScannerInput): void;

  addCommands(input: HermesScannerInput): void;
  addEvents(input: HermesScannerInput): void;
  addQueries(input: HermesScannerInput): void;
  addTimeouts(input: HermesScannerInput): void;

  addAggregates(input: HermesScannerInput): void;
  addSagas(input: HermesScannerInput): void;
  addViews(input: HermesScannerInput): void;

  getCommand(Command: Constructor): RegistryCommand;
  getEvent(Event: Constructor): RegistryEvent;
  getQuery(Query: Constructor): RegistryQuery;
  getTimeout(Timeout: Constructor): RegistryTimeout;

  isCommand(Command: Constructor): boolean;
  isEvent(Event: Constructor): boolean;
  isQuery(Query: Constructor): boolean;
  isTimeout(Timeout: Constructor): boolean;
}
