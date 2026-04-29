// Main class
export { Hermes } from "./classes/Hermes.js";
export { HermesSession } from "./classes/HermesSession.js";
export type { HermesSessionOptions } from "./classes/HermesSession.js";

// Base entity
export { HermesViewEntity } from "./entities/HermesViewEntity.js";

// Interfaces
export type { IHermes, IHermesProvider, IHermesSession } from "./interfaces/index.js";

// Decorators — DTO
export { Command, Event, Query, Timeout } from "./decorators/index.js";

// Decorators — Domain
export { Aggregate, Saga, View } from "./decorators/index.js";

// Decorators — Composable class
export { Forgettable, Namespace } from "./decorators/index.js";

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
} from "./decorators/index.js";

// Decorators — Composable methods
export { RequireCreated, RequireNotCreated, Validate } from "./decorators/index.js";

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
} from "./errors/index.js";

export type { DomainErrorOptions } from "./errors/index.js";

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
} from "./types/index.js";
