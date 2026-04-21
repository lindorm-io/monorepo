import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { UpcasterChainError } from "../../errors/index.js";
import type {
  HandlerRegistration,
  RegisteredAggregate,
  RegisteredDto,
  RegisteredSaga,
  RegisteredUpcaster,
  RegisteredView,
  ScannedModules,
} from "./types.js";

export class HermesRegistry {
  private readonly aggregatesByName: Map<string, RegisteredAggregate>;
  private readonly aggregatesByTarget: Map<Constructor, RegisteredAggregate>;

  private readonly sagasByName: Map<string, RegisteredSaga>;
  private readonly sagasByTarget: Map<Constructor, RegisteredSaga>;

  private readonly viewsByName: Map<string, RegisteredView>;
  private readonly viewsByTarget: Map<Constructor, RegisteredView>;

  private readonly commandsByTarget: Map<Constructor, RegisteredDto>;
  private readonly commandsByName: Map<string, RegisteredDto>;

  private readonly eventsByTarget: Map<Constructor, RegisteredDto>;
  private readonly eventsByName: Map<string, RegisteredDto>;

  private readonly queriesByTarget: Map<Constructor, RegisteredDto>;
  private readonly queriesByName: Map<string, RegisteredDto>;

  private readonly timeoutsByTarget: Map<Constructor, RegisteredDto>;
  private readonly timeoutsByName: Map<string, RegisteredDto>;

  private readonly commandHandlersByTrigger: Map<
    Constructor,
    HandlerRegistration & { aggregate: RegisteredAggregate }
  >;
  private readonly eventHandlersForAggregate: Map<
    string,
    Array<HandlerRegistration & { aggregate: RegisteredAggregate }>
  >;
  private readonly viewsForEvent: Map<Constructor, Array<RegisteredView>>;
  private readonly sagasForEvent: Map<Constructor, Array<RegisteredSaga>>;

  // eventName -> Map<fromVersion, RegisteredUpcaster>
  private readonly upcastersByEvent: Map<string, Map<number, RegisteredUpcaster>>;

  public constructor(modules: ScannedModules) {
    this.aggregatesByName = new Map();
    this.aggregatesByTarget = new Map();
    this.sagasByName = new Map();
    this.sagasByTarget = new Map();
    this.viewsByName = new Map();
    this.viewsByTarget = new Map();
    this.commandsByTarget = new Map();
    this.commandsByName = new Map();
    this.eventsByTarget = new Map();
    this.eventsByName = new Map();
    this.queriesByTarget = new Map();
    this.queriesByName = new Map();
    this.timeoutsByTarget = new Map();
    this.timeoutsByName = new Map();
    this.commandHandlersByTrigger = new Map();
    this.eventHandlersForAggregate = new Map();
    this.viewsForEvent = new Map();
    this.sagasForEvent = new Map();
    this.upcastersByEvent = new Map();

    this.populate(modules);
  }

  // -- DTO getters --

  public getCommand(target: Constructor): RegisteredDto {
    const dto = this.commandsByTarget.get(target);
    if (!dto) throw new Error(`Command not registered: ${target.name}`);
    return dto;
  }

  public getCommandByName(name: string, version?: number): RegisteredDto {
    if (version !== undefined) {
      const dto = this.commandsByName.get(HermesRegistry.dtoKey(name, version));
      if (!dto) throw new Error(`Command not found: ${name}:${version}`);
      return dto;
    }
    // Fallback: search by name only (picks first match)
    for (const dto of this.commandsByName.values()) {
      if (dto.name === name) return dto;
    }
    throw new Error(`Command not found: ${name}`);
  }

  public getEvent(target: Constructor): RegisteredDto {
    const dto = this.eventsByTarget.get(target);
    if (!dto) throw new Error(`Event not registered: ${target.name}`);
    return dto;
  }

  public getEventByName(name: string, version?: number): RegisteredDto {
    if (version !== undefined) {
      const dto = this.eventsByName.get(HermesRegistry.dtoKey(name, version));
      if (!dto) throw new Error(`Event not found: ${name}:${version}`);
      return dto;
    }
    // Fallback: search by name only (picks first match)
    for (const dto of this.eventsByName.values()) {
      if (dto.name === name) return dto;
    }
    throw new Error(`Event not found: ${name}`);
  }

  public getQuery(target: Constructor): RegisteredDto {
    const dto = this.queriesByTarget.get(target);
    if (!dto) throw new Error(`Query not registered: ${target.name}`);
    return dto;
  }

  public getTimeout(target: Constructor): RegisteredDto {
    const dto = this.timeoutsByTarget.get(target);
    if (!dto) throw new Error(`Timeout not registered: ${target.name}`);
    return dto;
  }

  public isCommand(target: Constructor): boolean {
    return this.commandsByTarget.has(target);
  }

  public isEvent(target: Constructor): boolean {
    return this.eventsByTarget.has(target);
  }

  public isQuery(target: Constructor): boolean {
    return this.queriesByTarget.has(target);
  }

  public isTimeout(target: Constructor): boolean {
    return this.timeoutsByTarget.has(target);
  }

  // -- Domain getters --

  public getAggregate(namespace: string, name: string): RegisteredAggregate {
    const aggregate = this.aggregatesByName.get(
      HermesRegistry.domainKey(namespace, name),
    );
    if (!aggregate) throw new Error(`Aggregate not found: ${namespace}.${name}`);
    return aggregate;
  }

  public getAggregateByTarget(target: Constructor): RegisteredAggregate {
    const aggregate = this.aggregatesByTarget.get(target);
    if (!aggregate) throw new Error(`Aggregate not registered: ${target.name}`);
    return aggregate;
  }

  public getSaga(namespace: string, name: string): RegisteredSaga {
    const saga = this.sagasByName.get(HermesRegistry.domainKey(namespace, name));
    if (!saga) throw new Error(`Saga not found: ${namespace}.${name}`);
    return saga;
  }

  public getSagaByTarget(target: Constructor): RegisteredSaga {
    const saga = this.sagasByTarget.get(target);
    if (!saga) throw new Error(`Saga not registered: ${target.name}`);
    return saga;
  }

  public getView(namespace: string, name: string): RegisteredView {
    const view = this.viewsByName.get(HermesRegistry.domainKey(namespace, name));
    if (!view) throw new Error(`View not found: ${namespace}.${name}`);
    return view;
  }

  public getViewByTarget(target: Constructor): RegisteredView {
    const view = this.viewsByTarget.get(target);
    if (!view) throw new Error(`View not registered: ${target.name}`);
    return view;
  }

  public getViewByEntity(entity: Constructor): RegisteredView {
    for (const view of this.viewsByTarget.values()) {
      if (view.entity === entity) {
        return view;
      }
    }
    throw new Error(`No view registered for entity: ${entity.name}`);
  }

  // -- Handler lookup --

  public getCommandHandler(
    commandTarget: Constructor,
  ): (HandlerRegistration & { aggregate: RegisteredAggregate }) | undefined {
    return this.commandHandlersByTrigger.get(commandTarget);
  }

  public getAggregateEventHandlers(
    namespace: string,
    name: string,
  ): Array<HandlerRegistration & { aggregate: RegisteredAggregate }> {
    return (
      this.eventHandlersForAggregate.get(HermesRegistry.domainKey(namespace, name)) ?? []
    );
  }

  public getAggregateForEvent(
    eventTarget: Constructor,
    scope: Array<{ name: string; namespace: string }>,
  ): RegisteredAggregate {
    for (const { name, namespace } of scope) {
      const aggregate = this.aggregatesByName.get(
        HermesRegistry.domainKey(namespace, name),
      );
      if (aggregate && aggregate.eventHandlers.some((h) => h.trigger === eventTarget)) {
        return aggregate;
      }
    }
    throw new Error(`No aggregate found for event: ${eventTarget.name}`);
  }

  public getViewsForEvent(eventTarget: Constructor): Array<RegisteredView> {
    return this.viewsForEvent.get(eventTarget) ?? [];
  }

  public getSagasForEvent(eventTarget: Constructor): Array<RegisteredSaga> {
    return this.sagasForEvent.get(eventTarget) ?? [];
  }

  // -- Collection getters --

  public get allAggregates(): Array<RegisteredAggregate> {
    return [...this.aggregatesByName.values()];
  }

  public get allSagas(): Array<RegisteredSaga> {
    return [...this.sagasByName.values()];
  }

  public get allViews(): Array<RegisteredView> {
    return [...this.viewsByName.values()];
  }

  public get allCommands(): Array<RegisteredDto> {
    return [...this.commandsByName.values()];
  }

  public get allEvents(): Array<RegisteredDto> {
    return [...this.eventsByName.values()];
  }

  public get allQueries(): Array<RegisteredDto> {
    return [...this.queriesByName.values()];
  }

  public get allTimeouts(): Array<RegisteredDto> {
    return [...this.timeoutsByName.values()];
  }

  // -- Upcaster lookup --

  public getUpcasterChain(
    eventName: string,
    fromVersion: number,
    toVersion: number,
  ): Array<RegisteredUpcaster> {
    if (fromVersion >= toVersion) return [];

    const versionMap = this.upcastersByEvent.get(eventName);
    if (!versionMap) return [];

    const chain: Array<RegisteredUpcaster> = [];
    let current = fromVersion;

    while (current < toVersion) {
      const upcaster = versionMap.get(current);
      if (!upcaster) {
        throw new UpcasterChainError(
          `Upcaster chain gap: no upcaster from v${current} for event "${eventName}"`,
        );
      }
      chain.push(upcaster);
      current = upcaster.toVersion;
    }

    return chain;
  }

  // -- Startup validation (L4) --

  public validate(logger: ILogger): void {
    for (const event of this.eventsByName.values()) {
      const hasAggregateHandler = this.allAggregates.some((agg) =>
        agg.eventHandlers.some((h) => h.trigger === event.target),
      );
      const hasSagaHandler = this.allSagas.some((saga) =>
        [...saga.eventHandlers, ...saga.idHandlers].some(
          (h) => h.trigger === event.target,
        ),
      );
      const hasViewHandler = this.allViews.some((view) =>
        [...view.eventHandlers, ...view.idHandlers].some(
          (h) => h.trigger === event.target,
        ),
      );

      if (!hasAggregateHandler && !hasSagaHandler && !hasViewHandler) {
        logger.warn("Event has no registered handlers", {
          event: { name: event.name, version: event.version },
        });
      }
    }

    this.validateUpcasters(logger);
  }

  // -- Compound key helpers --

  private static domainKey(namespace: string, name: string): string {
    return `${namespace}.${name}`;
  }

  private static dtoKey(name: string, version: number): string {
    return `${name}:${version}`;
  }

  private validateUpcasters(logger: ILogger): void {
    for (const [eventName, versionMap] of this.upcastersByEvent) {
      const fromVersions = [...versionMap.keys()].sort((a, b) => a - b);

      if (fromVersions.length === 0) continue;

      // Check for contiguous chain: each toVersion should equal the next fromVersion
      for (let i = 0; i < fromVersions.length - 1; i++) {
        const current = versionMap.get(fromVersions[i])!;
        const nextFrom = fromVersions[i + 1];

        if (current.toVersion !== nextFrom) {
          logger.warn("Upcaster chain gap detected", {
            event: eventName,
            missingFrom: current.toVersion,
            missingTo: nextFrom,
          });
        }
      }
    }
  }

  // -- Population --

  private populate(modules: ScannedModules): void {
    this.populateDtos(modules);
    this.populateAggregates(modules);
    this.populateSagas(modules);
    this.populateViews(modules);
  }

  private populateDtos(modules: ScannedModules): void {
    for (const dto of modules.commands) {
      this.commandsByTarget.set(dto.target, dto);
      this.commandsByName.set(HermesRegistry.dtoKey(dto.name, dto.version), dto);
    }
    for (const dto of modules.events) {
      this.eventsByTarget.set(dto.target, dto);
      this.eventsByName.set(HermesRegistry.dtoKey(dto.name, dto.version), dto);
    }
    for (const dto of modules.queries) {
      this.queriesByTarget.set(dto.target, dto);
      this.queriesByName.set(dto.name, dto);
    }
    for (const dto of modules.timeouts) {
      this.timeoutsByTarget.set(dto.target, dto);
      this.timeoutsByName.set(dto.name, dto);
    }
  }

  private populateAggregates(modules: ScannedModules): void {
    for (const aggregate of modules.aggregates) {
      const key = HermesRegistry.domainKey(aggregate.namespace, aggregate.name);
      this.aggregatesByName.set(key, aggregate);
      this.aggregatesByTarget.set(aggregate.target, aggregate);

      // Index command handlers by trigger constructor
      for (const handler of aggregate.commandHandlers) {
        this.commandHandlersByTrigger.set(handler.trigger, { ...handler, aggregate });
      }

      // Index event handlers by aggregate compound key
      const eventHandlers = this.eventHandlersForAggregate.get(key) ?? [];
      for (const handler of aggregate.eventHandlers) {
        eventHandlers.push({ ...handler, aggregate });
      }
      this.eventHandlersForAggregate.set(key, eventHandlers);

      // Validate: no two event handlers for the same event name within one aggregate
      const seenEventNames = new Set<string>();
      for (const handler of aggregate.eventHandlers) {
        const dto = this.eventsByTarget.get(handler.trigger);
        if (!dto) continue;
        if (seenEventNames.has(dto.name)) {
          throw new Error(
            `Aggregate "${aggregate.namespace}.${aggregate.name}" has duplicate event handlers ` +
              `for event "${dto.name}". Only one handler per event name is allowed ` +
              `(use @EventUpcaster for version migration).`,
          );
        }
        seenEventNames.add(dto.name);
      }

      // Index upcasters by event name and fromVersion
      for (const upcaster of aggregate.upcasters) {
        let versionMap = this.upcastersByEvent.get(upcaster.fromName);
        if (!versionMap) {
          versionMap = new Map();
          this.upcastersByEvent.set(upcaster.fromName, versionMap);
        }

        if (versionMap.has(upcaster.fromVersion)) {
          throw new Error(
            `Duplicate upcaster: event "${upcaster.fromName}" v${upcaster.fromVersion} ` +
              `is already registered`,
          );
        }

        versionMap.set(upcaster.fromVersion, upcaster);
      }
    }
  }

  private populateSagas(modules: ScannedModules): void {
    for (const saga of modules.sagas) {
      this.sagasByName.set(HermesRegistry.domainKey(saga.namespace, saga.name), saga);
      this.sagasByTarget.set(saga.target, saga);

      // Index sagas by the events they listen to
      for (const handler of saga.eventHandlers) {
        const list = this.sagasForEvent.get(handler.trigger) ?? [];
        if (!list.includes(saga)) {
          list.push(saga);
        }
        this.sagasForEvent.set(handler.trigger, list);
      }

      // Id handlers also receive events
      for (const handler of saga.idHandlers) {
        const list = this.sagasForEvent.get(handler.trigger) ?? [];
        if (!list.includes(saga)) {
          list.push(saga);
        }
        this.sagasForEvent.set(handler.trigger, list);
      }
    }
  }

  private populateViews(modules: ScannedModules): void {
    for (const view of modules.views) {
      this.viewsByName.set(HermesRegistry.domainKey(view.namespace, view.name), view);
      this.viewsByTarget.set(view.target, view);

      // Index views by the events they listen to
      for (const handler of view.eventHandlers) {
        const list = this.viewsForEvent.get(handler.trigger) ?? [];
        if (!list.includes(view)) {
          list.push(view);
        }
        this.viewsForEvent.set(handler.trigger, list);
      }

      // Id handlers also receive events
      for (const handler of view.idHandlers) {
        const list = this.viewsForEvent.get(handler.trigger) ?? [];
        if (!list.includes(view)) {
          list.push(view);
        }
        this.viewsForEvent.set(handler.trigger, list);
      }
    }
  }
}
