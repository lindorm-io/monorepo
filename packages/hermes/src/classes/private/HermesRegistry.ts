import { snakeCase } from "@lindorm/case";
import { Constructor, Dict } from "@lindorm/types";
import {
  HermesAggregateCommandHandler,
  HermesAggregateErrorHandler,
  HermesAggregateEventHandler,
  HermesSagaErrorHandler,
  HermesSagaEventHandler,
  HermesSagaIdHandler,
  HermesSagaTimeoutHandler,
  HermesViewErrorHandler,
  HermesViewEventHandler,
  HermesViewIdHandler,
  HermesViewQueryHandler,
} from "../../handlers";
import {
  IAggregateCommandHandler,
  IAggregateErrorHandler,
  IAggregateEventHandler,
  IHermesRegistry,
  ISagaErrorHandler,
  ISagaEventHandler,
  ISagaIdHandler,
  ISagaTimeoutHandler,
  IViewErrorHandler,
  IViewEventHandler,
  IViewIdHandler,
  IViewQueryHandler,
} from "../../interfaces";
import {
  AggregateCommandCallback,
  AggregateErrorCallback,
  AggregateEventCallback,
  HermesRegistryOptions,
  HermesScannerInput,
  MetaAggregate,
  MetaCommand,
  MetaEvent,
  MetaHandler,
  MetaQuery,
  MetaSaga,
  MetaTimeout,
  MetaView,
  RegistryAggregate,
  RegistryCommand,
  RegistryEvent,
  RegistryQuery,
  RegistrySaga,
  RegistryTimeout,
  RegistryView,
  SagaErrorCallback,
  SagaEventCallback,
  SagaIdCallback,
  SagaTimeoutCallback,
  ViewErrorCallback,
  ViewEventCallback,
  ViewIdCallback,
  ViewQueryCallback,
} from "../../types";
import { globalHermesMetadata } from "../../utils/private";
import { HermesScanner } from "./HermesScanner";

export class HermesRegistry implements IHermesRegistry {
  private readonly namespace: string;

  private readonly commandCtors: Array<Constructor>;
  private readonly eventCtors: Array<Constructor>;
  private readonly queryCtors: Array<Constructor>;
  private readonly timeoutCtors: Array<Constructor>;

  public readonly commands: Array<RegistryCommand>;
  public readonly events: Array<RegistryEvent>;
  public readonly queries: Array<RegistryQuery>;
  public readonly timeouts: Array<RegistryTimeout>;

  public readonly aggregates: Array<RegistryAggregate>;
  public readonly sagas: Array<RegistrySaga>;
  public readonly views: Array<RegistryView>;

  public readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  public readonly aggregateErrorHandlers: Array<IAggregateErrorHandler>;
  public readonly aggregateEventHandlers: Array<IAggregateEventHandler>;

  public readonly sagaErrorHandlers: Array<ISagaErrorHandler>;
  public readonly sagaEventHandlers: Array<ISagaEventHandler>;
  public readonly sagaIdHandlers: Array<ISagaIdHandler>;
  public readonly sagaTimeoutHandlers: Array<ISagaTimeoutHandler>;

  public readonly viewErrorHandlers: Array<IViewErrorHandler>;
  public readonly viewEventHandlers: Array<IViewEventHandler>;
  public readonly viewIdHandlers: Array<IViewIdHandler>;
  public readonly viewQueryHandlers: Array<IViewQueryHandler>;

  public constructor(options: HermesRegistryOptions = {}) {
    this.namespace = options.namespace ?? "hermes";

    this.commandCtors = [];
    this.eventCtors = [];
    this.queryCtors = [];
    this.timeoutCtors = [];

    this.commands = [];
    this.events = [];
    this.queries = [];
    this.timeouts = [];

    this.aggregates = [];
    this.sagas = [];
    this.views = [];

    this.aggregateCommandHandlers = [];
    this.aggregateErrorHandlers = [];
    this.aggregateEventHandlers = [];

    this.sagaIdHandlers = [];
    this.sagaErrorHandlers = [];
    this.sagaEventHandlers = [];
    this.sagaTimeoutHandlers = [];

    this.viewIdHandlers = [];
    this.viewErrorHandlers = [];
    this.viewEventHandlers = [];
    this.viewQueryHandlers = [];
  }

  // add

  public add(input: HermesScannerInput): void {
    this.addCommands(input);
    this.addEvents(input);
    this.addQueries(input);
    this.addTimeouts(input);

    this.addAggregates(input);
    this.addSagas(input);
    this.addViews(input);
  }

  // add dtos

  public addCommands(input: HermesScannerInput): void {
    const commands = HermesScanner.scan(input);

    for (const Command of commands) {
      if (this.commands.some((c) => c.target === Command)) continue;

      const metadata = globalHermesMetadata.getCommand(Command);
      if (!metadata) continue;

      this.commandCtors.push(Command);
    }
  }

  public addEvents(input: HermesScannerInput): void {
    const events = HermesScanner.scan(input);

    for (const Event of events) {
      if (this.events.some((c) => c.target === Event)) continue;

      const metadata = globalHermesMetadata.getEvent(Event);
      if (!metadata) continue;

      this.eventCtors.push(Event);
    }
  }

  public addQueries(input: HermesScannerInput): void {
    const queries = HermesScanner.scan(input);

    for (const Query of queries) {
      if (this.queries.some((c) => c.target === Query)) continue;

      const metadata = globalHermesMetadata.getQuery(Query);
      if (!metadata) continue;

      this.queryCtors.push(Query);
    }
  }

  public addTimeouts(input: HermesScannerInput): void {
    const timeouts = HermesScanner.scan(input);

    for (const Timeout of timeouts) {
      if (this.timeouts.some((c) => c.target === Timeout)) continue;

      const metadata = globalHermesMetadata.getTimeout(Timeout);
      if (!metadata) continue;

      this.timeoutCtors.push(Timeout);
    }
  }

  // add handlers

  public addAggregates(input: HermesScannerInput): void {
    const aggregates = HermesScanner.scan(input);

    for (const Aggregate of aggregates) {
      if (this.aggregates.some((c) => c.target === Aggregate)) continue;

      const metadata = globalHermesMetadata.getAggregate(Aggregate);
      if (!metadata) return;

      for (const handler of metadata.handlers) {
        switch (handler.decorator) {
          case "AggregateCommandHandler":
            this.registerAggregateCommandHandler(metadata, handler);
            break;

          case "AggregateErrorHandler":
            this.registerAggregateErrorHandler(metadata, handler);
            break;

          case "AggregateEventHandler":
            this.registerAggregateEventHandler(metadata, handler);
            break;

          default:
            break;
        }
      }

      this.aggregates.push({
        encryption: metadata.encryption,
        name: metadata.name,
        namespace: metadata.namespace ?? this.namespace,
        target: Aggregate,
      });
    }
  }

  public addSagas(input: HermesScannerInput): void {
    const sagas = HermesScanner.scan(input);

    const aggregates: Array<MetaAggregate> = [];

    for (const Saga of sagas) {
      if (this.sagas.some((c) => c.target === Saga)) continue;

      const saga = globalHermesMetadata.getSaga(Saga);
      if (!saga) continue;

      for (const Aggregate of saga.aggregates) {
        const aggregate = globalHermesMetadata.getAggregate(Aggregate);

        if (!aggregate) {
          throw new Error(`Aggregate not found for saga: ${saga.name}`);
        }

        aggregates.push(aggregate);

        for (const handler of saga.handlers) {
          switch (handler.decorator) {
            case "SagaErrorHandler":
              this.registerSagaErrorHandler(aggregate, saga, handler);
              break;

            case "SagaEventHandler":
              this.registerSagaEventHandler(aggregate, saga, handler);
              break;

            case "SagaIdHandler":
              this.registerSagaIdHandler(aggregate, saga, handler);
              break;

            case "SagaTimeoutHandler":
              this.registerSagaTimeoutHandler(aggregate, saga, handler);
              break;

            default:
              break;
          }
        }
      }

      this.sagas.push({
        aggregates: aggregates.map((a) => ({
          name: a.name,
          namespace: a.namespace ?? this.namespace,
        })),
        name: saga.name,
        namespace: saga.namespace ?? this.namespace,
        target: Saga,
      });
    }
  }

  public addViews(input: HermesScannerInput): void {
    const views = HermesScanner.scan(input);

    const aggregates: Array<MetaAggregate> = [];

    for (const View of views) {
      if (this.views.some((c) => c.target === View)) continue;

      const view = globalHermesMetadata.getView(View);
      if (!view) continue;

      for (const Aggregate of view.aggregates) {
        const aggregate = globalHermesMetadata.getAggregate(Aggregate);

        if (!aggregate) {
          throw new Error(`Aggregate not found for view: ${view.name}`);
        }

        aggregates.push(aggregate);

        for (const handler of view.handlers) {
          switch (handler.decorator) {
            case "ViewErrorHandler":
              this.registerViewErrorHandler(aggregate, view, handler);
              break;

            case "ViewEventHandler":
              this.registerViewEventHandler(aggregate, view, handler);
              break;

            case "ViewIdHandler":
              this.registerViewIdHandler(aggregate, view, handler);
              break;

            case "ViewQueryHandler":
              this.registerViewQueryHandler(view, handler);
              break;

            default:
              break;
          }
        }
      }

      this.views.push({
        aggregates: aggregates.map((a) => ({
          name: a.name,
          namespace: a.namespace ?? this.namespace,
        })),
        name: view.name,
        namespace: view.namespace ?? this.namespace,
        source: view.source,
        target: View,
      });
    }
  }

  // get dto

  public getCommand(Command: Constructor): RegistryCommand {
    const command = this.commands.find((c) => c.target === Command);
    if (!command) {
      throw new Error(`Command not found: ${Command.name}`);
    }
    return command;
  }

  public getEvent(Event: Constructor): RegistryEvent {
    const event = this.events.find((c) => c.target === Event);
    if (!event) {
      throw new Error(`Event not found: ${Event.name}`);
    }
    return event;
  }

  public getQuery(Query: Constructor): RegistryQuery {
    const query = this.queries.find((c) => c.target === Query);
    if (!query) {
      throw new Error(`Query not found: ${Query.name}`);
    }
    return query;
  }

  public getTimeout(Timeout: Constructor): RegistryTimeout {
    const timeout = this.timeouts.find((c) => c.target === Timeout);
    if (!timeout) {
      throw new Error(`Timeout not found: ${Timeout.name}`);
    }
    return timeout;
  }

  // is dto

  public isCommand(Command: Constructor): boolean {
    return !!this.commands.find((c) => c.target === Command);
  }

  public isEvent(Event: Constructor): boolean {
    return !!this.events.find((c) => c.target === Event);
  }

  public isQuery(Query: Constructor): boolean {
    return !!this.queries.find((c) => c.target === Query);
  }

  public isTimeout(Timeout: Constructor): boolean {
    return !!this.timeouts.find((c) => c.target === Timeout);
  }

  // private dtos

  private registerCommand(command: MetaCommand, aggregate: MetaAggregate): void {
    if (!this.commandCtors.includes(command.target)) {
      throw new Error(`Command not found: ${command.target.name}`);
    }

    if (this.commands.some((c) => c.target === command.target)) {
      return;
    }

    this.commands.push({
      aggregate: {
        name: aggregate.name,
        namespace: aggregate.namespace ?? this.namespace,
      },
      name: command.name,
      target: command.target,
    });
  }

  private registerEvent(event: MetaEvent, aggregate: MetaAggregate): void {
    if (!this.eventCtors.includes(event.target)) {
      throw new Error(`Event not found: ${event.target.name}`);
    }

    if (this.events.some((c) => c.target === event.target)) {
      return;
    }

    this.events.push({
      aggregate: {
        name: aggregate.name,
        namespace: aggregate.namespace ?? this.namespace,
      },
      name: event.name,
      target: event.target,
      version: event.version,
    });
  }

  private registerQuery(query: MetaQuery, view: MetaView): void {
    if (!this.queryCtors.includes(query.target)) {
      throw new Error(`Query not found: ${query.target.name}`);
    }

    if (this.queries.some((c) => c.target === query.target)) {
      return;
    }

    this.queries.push({
      name: query.name,
      target: query.target,
      view: { name: view.name, namespace: view.namespace ?? this.namespace },
    });
  }

  private registerTimeout(
    timeout: MetaTimeout,
    aggregate: MetaAggregate,
    saga: MetaSaga,
  ): void {
    if (!this.timeoutCtors.includes(timeout.target)) {
      throw new Error(`Timeout not found: ${timeout.target.name}`);
    }

    if (this.timeouts.some((c) => c.target === timeout.target)) {
      return;
    }

    this.timeouts.push({
      aggregate: {
        name: aggregate.name,
        namespace: aggregate.namespace ?? this.namespace,
      },
      name: timeout.name,
      saga: { name: saga.name, namespace: saga.namespace ?? this.namespace },
      target: timeout.target,
    });
  }

  // private aggregate handlers

  private registerAggregateCommandHandler(
    aggregate: MetaAggregate,
    handler: MetaHandler<AggregateCommandCallback<Constructor, Dict>>,
  ): void {
    const command = globalHermesMetadata.getCommand(handler.trigger);

    if (!command) {
      throw new Error(`Command not found for handler: ${handler.key}`);
    }

    if (command.target !== handler.trigger) {
      throw new Error(`Command/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.aggregateCommandHandlers.some(
        (h) =>
          h.command === command.name &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace,
      )
    ) {
      return;
    }

    this.registerCommand(command, aggregate);

    this.aggregateCommandHandlers.push(
      new HermesAggregateCommandHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        command: command.name,
        conditions: handler.conditions ?? undefined,
        encryption: handler.encryption ?? aggregate.encryption ?? false,
        key: handler.key,
        schema: handler.schema ?? undefined,
        handler: handler.handler,
      }),
    );
  }

  private registerAggregateErrorHandler(
    aggregate: MetaAggregate,
    handler: MetaHandler<AggregateErrorCallback<Constructor>>,
  ): void {
    if (
      this.viewErrorHandlers.some(
        (h) =>
          h.error === handler.trigger.name &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace,
      )
    ) {
      return;
    }

    this.aggregateErrorHandlers.push(
      new HermesAggregateErrorHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        error: snakeCase(handler.trigger.name),
        key: handler.key,
        handler: handler.handler,
      }),
    );
  }

  private registerAggregateEventHandler(
    aggregate: MetaAggregate,
    handler: MetaHandler<AggregateEventCallback<Constructor, Dict>>,
  ): void {
    const event = globalHermesMetadata.getEvent(handler.trigger);

    if (!event) {
      throw new Error(`Event not found for handler: ${handler.key}`);
    }

    if (event.target !== handler.trigger) {
      throw new Error(`Event/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.aggregateEventHandlers.some(
        (h) =>
          h.event.name === event.name &&
          h.event.version === event.version &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace,
      )
    ) {
      return;
    }

    this.registerEvent(event, aggregate);

    this.aggregateEventHandlers.push(
      new HermesAggregateEventHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        event: { name: event.name, version: event.version },
        key: handler.key,
        handler: handler.handler,
      }),
    );
  }

  // private saga handlers

  private registerSagaErrorHandler(
    aggregate: MetaAggregate,
    saga: MetaSaga,
    handler: MetaHandler<SagaErrorCallback<Constructor>>,
  ): void {
    if (
      this.sagaErrorHandlers.some(
        (h) =>
          h.error === handler.trigger.name &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.saga.name === saga.name &&
          h.saga.namespace === saga.namespace,
      )
    ) {
      return;
    }

    this.sagaErrorHandlers.push(
      new HermesSagaErrorHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        error: snakeCase(handler.trigger.name),
        key: handler.key,
        saga: { name: saga.name, namespace: saga.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerSagaEventHandler(
    aggregate: MetaAggregate,
    saga: MetaSaga,
    handler: MetaHandler<SagaEventCallback<Constructor, Dict>>,
  ): void {
    const event = globalHermesMetadata.getEvent(handler.trigger);

    if (!event) {
      throw new Error(`Event not found for handler: ${handler.key}`);
    }

    if (event.target !== handler.trigger) {
      throw new Error(`Event/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.sagaEventHandlers.some(
        (h) =>
          h.event.name === event.name &&
          h.event.version === event.version &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.saga.name === saga.name &&
          h.saga.namespace === saga.namespace,
      )
    ) {
      return;
    }

    this.registerEvent(event, aggregate);

    this.sagaEventHandlers.push(
      new HermesSagaEventHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        conditions: handler.conditions ?? undefined,
        event: { name: event.name, version: event.version },
        key: handler.key,
        saga: { name: saga.name, namespace: saga.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerSagaIdHandler(
    aggregate: MetaAggregate,
    saga: MetaSaga,
    handler: MetaHandler<SagaIdCallback<Constructor>>,
  ): void {
    const event = globalHermesMetadata.getEvent(handler.trigger);

    if (!event) {
      throw new Error(`Event not found for handler: ${handler.key}`);
    }

    if (event.target !== handler.trigger) {
      throw new Error(`Event/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.sagaIdHandlers.some(
        (h) =>
          h.event.name === event.name &&
          h.event.version === event.version &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.saga.name === saga.name &&
          h.saga.namespace === saga.namespace,
      )
    ) {
      return;
    }

    this.registerEvent(event, aggregate);

    this.sagaIdHandlers.push(
      new HermesSagaIdHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        event: { name: event.name, version: event.version },
        key: handler.key,
        saga: { name: saga.name, namespace: saga.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerSagaTimeoutHandler(
    aggregate: MetaAggregate,
    saga: MetaSaga,
    handler: MetaHandler<SagaTimeoutCallback<Constructor, Dict>>,
  ): void {
    const timeout = globalHermesMetadata.getTimeout(handler.trigger);

    if (!timeout) {
      throw new Error(`Timeout not found for handler: ${handler.key}`);
    }

    if (timeout.target !== handler.trigger) {
      throw new Error(`Timeout/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.sagaTimeoutHandlers.some(
        (h) =>
          h.timeout === timeout.name &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.saga.name === saga.name &&
          h.saga.namespace === saga.namespace,
      )
    ) {
      return;
    }

    this.registerTimeout(timeout, aggregate, saga);

    this.sagaTimeoutHandlers.push(
      new HermesSagaTimeoutHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        key: handler.key,
        saga: { name: saga.name, namespace: saga.namespace ?? this.namespace },
        timeout: timeout.name,
        handler: handler.handler,
      }),
    );
  }

  // private view handlers

  private registerViewErrorHandler(
    aggregate: MetaAggregate,
    view: MetaView,
    handler: MetaHandler<ViewErrorCallback<Constructor>>,
  ): void {
    if (
      this.viewErrorHandlers.some(
        (h) =>
          h.error === handler.trigger.name &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.view.name === view.name &&
          h.view.namespace === view.namespace,
      )
    ) {
      return;
    }

    this.viewErrorHandlers.push(
      new HermesViewErrorHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        error: snakeCase(handler.trigger.name),
        key: handler.key,
        view: { name: view.name, namespace: view.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerViewEventHandler(
    aggregate: MetaAggregate,
    view: MetaView,
    handler: MetaHandler<ViewEventCallback<Constructor, Dict>>,
  ): void {
    const event = globalHermesMetadata.getEvent(handler.trigger);

    if (!event) {
      throw new Error(`Event not found for handler: ${handler.key}`);
    }

    if (event.target !== handler.trigger) {
      throw new Error(`Event/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.viewEventHandlers.some(
        (h) =>
          h.event.name === event.name &&
          h.event.version === event.version &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.view.name === view.name &&
          h.view.namespace === view.namespace,
      )
    ) {
      return;
    }

    this.registerEvent(event, aggregate);

    this.viewEventHandlers.push(
      new HermesViewEventHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        conditions: handler.conditions ?? undefined,
        event: { name: event.name, version: event.version },
        key: handler.key,
        source: view.source,
        view: { name: view.name, namespace: view.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerViewIdHandler(
    aggregate: MetaAggregate,
    view: MetaView,
    handler: MetaHandler<ViewIdCallback<Constructor>>,
  ): void {
    const event = globalHermesMetadata.getEvent(handler.trigger);

    if (!event) {
      throw new Error(`Event not found for handler: ${handler.key}`);
    }

    if (event.target !== handler.trigger) {
      throw new Error(`Event/Aggregate mismatch for handler: ${handler.key}`);
    }

    if (
      this.viewIdHandlers.some(
        (h) =>
          h.event.name === event.name &&
          h.event.version === event.version &&
          h.aggregate.name === aggregate.name &&
          h.aggregate.namespace === aggregate.namespace &&
          h.view.name === view.name &&
          h.view.namespace === view.namespace,
      )
    ) {
      return;
    }

    this.registerEvent(event, aggregate);

    this.viewIdHandlers.push(
      new HermesViewIdHandler({
        aggregate: {
          name: aggregate.name,
          namespace: aggregate.namespace ?? this.namespace,
        },
        event: { name: event.name, version: event.version },
        key: handler.key,
        view: { name: view.name, namespace: view.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }

  private registerViewQueryHandler(
    view: MetaView,
    handler: MetaHandler<ViewQueryCallback<Constructor, Dict>>,
  ): void {
    const query = globalHermesMetadata.getQuery(handler.trigger);

    if (!query) {
      throw new Error(`Query not found for handler: ${handler.key}`);
    }

    if (
      this.viewQueryHandlers.some(
        (h) =>
          h.query === query.name &&
          h.source === view.source &&
          h.view.name === view.name &&
          h.view.namespace === view.namespace,
      )
    ) {
      return;
    }

    this.registerQuery(query, view);

    this.viewQueryHandlers.push(
      new HermesViewQueryHandler({
        key: handler.key,
        query: query.name,
        source: view.source,
        view: { name: view.name, namespace: view.namespace ?? this.namespace },
        handler: handler.handler,
      }),
    );
  }
}
