// Main class
export { Hermes } from "./classes/Hermes";
export { HermesSession } from "./classes/HermesSession";
export type { HermesSessionOptions } from "./classes/HermesSession";

// Base entity
export { HermesViewEntity } from "./entities/HermesViewEntity";

// Interfaces
export type { IHermes, IHermesProvider, IHermesSession } from "./interfaces";

// Decorators — DTO
export { Command, Event, Query, Timeout } from "./decorators";

// Decorators — Domain
export { Aggregate, Saga, View } from "./decorators";

// Decorators — Composable class
export { Forgettable, Namespace } from "./decorators";

// Decorators — Handler methods
export {
  AggregateCommandHandler,
  AggregateErrorHandler,
  AggregateEventHandler,
  EventUpcaster,
  SagaErrorHandler,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
  ViewErrorHandler,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
} from "./decorators";

// Decorators — Composable methods
export { RequireCreated, RequireNotCreated, Validate } from "./decorators";

// Errors
export {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  AggregateNotDestroyedError,
  CausationMissingEventsError,
  ChecksumError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  UpcasterChainError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
  ViewNotUpdatedError,
} from "./errors";

export type { DomainErrorOptions } from "./errors";

// Types
export type {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateEventCtx,
  AggregateIdentifier,
  AggregateState,
  ChecksumMode,
  ErrorDispatchOptions,
  HermesEventName,
  HermesOptions,
  HermesStatus,
  ReplayHandle,
  ReplayOptions,
  ReplayProgress,
  SagaDispatchOptions,
  SagaErrorCtx,
  SagaEventCtx,
  SagaIdCtx,
  SagaState,
  SagaTimeoutCtx,
  ViewErrorCtx,
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
} from "./types";
