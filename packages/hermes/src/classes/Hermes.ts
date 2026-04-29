import type { IIrisMessageBus, IIrisSource, IIrisWorkerQueue } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import EventEmitter from "events";
import { ms } from "@lindorm/date";
import { LindormError } from "@lindorm/errors";
import { randomUUID } from "@lindorm/random";
import { HermesViewEntity } from "../entities/HermesViewEntity.js";
import { ChecksumError, HandlerNotRegisteredError } from "../errors/index.js";
import type { IHermes } from "../interfaces/IHermes.js";
import type { HermesEventName } from "../types/hermes-event-name.js";
import type { AggregateIdentifier } from "../types/aggregate-identifier.js";
import type { AggregateState } from "../types/aggregate-state.js";
import type { ChecksumMode, HermesOptions } from "../types/hermes-options.js";
import type { HermesStatus } from "../types/hermes-status.js";
import type {
  ReplayHandle,
  ReplayOptions,
  ReplayProgress,
} from "../types/replay-types.js";
import type { SagaState } from "../types/saga-state.js";
import {
  AggregateDomain,
  ChecksumDomain,
  SagaDomain,
  ViewDomain,
} from "../internal/domains/index.js";
import {
  CausationRecord,
  ChecksumRecord,
  EncryptionRecord,
  EventRecord,
  SagaRecord,
} from "../internal/entities/index.js";
import {
  HermesCommandMessage,
  HermesErrorMessage,
  HermesEventMessage,
  HermesTimeoutMessage,
} from "../internal/messages/index.js";
import { HermesRegistry, HermesScanner } from "../internal/registry/index.js";
import { assertChecksum, extractDto } from "../internal/utils/index.js";
import { HermesSession } from "./HermesSession.js";

const DEFAULT_NAMESPACE = "hermes";

type StatusRef = { current: HermesStatus };

/**
 * Hermes delegates message retry and dead-letter queue (DLQ) handling entirely
 * to Iris. Configure retry limits and DLQ behaviour via Iris source options,
 * not through Hermes.
 */
export class Hermes implements IHermes {
  private readonly logger: ILogger;
  private readonly namespace: string;
  private readonly causationExpiryMs: number;
  private readonly checksumMode: ChecksumMode;

  private readonly proteus: IProteusSource;
  private readonly viewSourceMap: Map<string, IProteusSource>;
  private readonly iris: IIrisSource;
  private readonly options: HermesOptions;

  private registry!: HermesRegistry;
  private aggregateDomain!: AggregateDomain;
  private checksumDomain!: ChecksumDomain;
  private sagaDomain!: SagaDomain;
  private viewDomain!: ViewDomain;

  private commandQueue!: IIrisWorkerQueue<HermesCommandMessage>;
  private eventBus!: IIrisMessageBus<HermesEventMessage>;
  private errorQueue!: IIrisWorkerQueue<HermesErrorMessage>;
  private timeoutQueue!: IIrisWorkerQueue<HermesTimeoutMessage>;

  private readonly _statusRef: StatusRef;

  public constructor(options: HermesOptions) {
    this.logger = options.logger.child(["Hermes"]);
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    this.checksumMode = options.checksumMode ?? "warn";
    this._statusRef = { current: "created" };
    this.options = options;

    this.proteus = options.proteus;
    this.iris = options.iris;

    this.viewSourceMap = new Map();

    if (options.viewSources) {
      for (const source of options.viewSources) {
        this.viewSourceMap.set(source.driverType, source);
      }
    }

    this.causationExpiryMs = options.causationExpiry
      ? ms(options.causationExpiry)
      : ms("30 Days");
  }

  // -- Public getters --

  public get status(): HermesStatus {
    return this._statusRef.current;
  }

  public get admin(): IHermes["admin"] {
    return {
      inspect: {
        aggregate: this.inspectAggregate.bind(this),
        saga: this.inspectSaga.bind(this),
        view: this.inspectView.bind(this),
      },
      purgeCausations: this.purgeCausations.bind(this),
      replay: {
        view: this.replayView.bind(this),
        aggregate: this.replayAggregate.bind(this),
      },
    };
  }

  // -- Lifecycle --

  public async setup(): Promise<void> {
    if (this._statusRef.current !== "created") {
      throw new LindormError("Hermes.setup() can only be called once", {
        data: { status: this._statusRef.current },
      });
    }

    this._statusRef.current = "initialising";

    try {
      this.logger.debug("Scanning modules");

      const scanned = await HermesScanner.scan(this.options.modules);
      this.registry = new HermesRegistry(scanned);

      this.logger.debug("Registry built", {
        aggregates: this.registry.allAggregates.length,
        sagas: this.registry.allSagas.length,
        views: this.registry.allViews.length,
        commands: this.registry.allCommands.length,
        events: this.registry.allEvents.length,
        queries: this.registry.allQueries.length,
        timeouts: this.registry.allTimeouts.length,
      });

      this.registry.validate(this.logger);

      this.registerEntities();
      this.registerIrisMessages();

      await this.setupSources();
      await this.setupIris();

      this.createIrisPrimitives();
      this.createDomains();

      await this.registerDomainHandlers();

      this._statusRef.current = "ready";

      this.logger.verbose("Hermes ready");
    } catch (err) {
      this._statusRef.current = "created";
      throw err;
    }
  }

  public async teardown(): Promise<void> {
    this.assertReady();

    this._statusRef.current = "stopping";

    this.logger.debug("Tearing down");

    await this.commandQueue.unconsumeAll();
    await this.eventBus.unsubscribeAll();
    await this.errorQueue.unconsumeAll();
    await this.timeoutQueue.unconsumeAll();

    this.sagaDomain.removeAllListeners();
    this.viewDomain.removeAllListeners();
    this.checksumDomain.removeAllListeners();

    this._statusRef.current = "stopped";

    this.logger.verbose("Hermes stopped");
  }

  public session(options: { logger?: ILogger } = {}): HermesSession {
    return new HermesSession({
      logger: options.logger ?? this.logger,
      statusRef: this._statusRef,
      registry: this.registry,
      viewDomain: this.viewDomain,
      commandQueue: this.commandQueue,
    });
  }

  // -- Command --

  public async command(
    command: ClassLike,
    options: { id?: string; correlationId?: string; delay?: number; meta?: Dict } = {},
  ): Promise<AggregateIdentifier> {
    this.assertReady();

    const metadata = this.registry.getCommand(command.constructor as Constructor);
    const commandHandler = this.registry.getCommandHandler(
      command.constructor as Constructor,
    );

    if (!commandHandler) {
      throw new HandlerNotRegisteredError();
    }

    const aggregate: AggregateIdentifier = {
      id: options.id || randomUUID(),
      name: commandHandler.aggregate.name,
      namespace: commandHandler.aggregate.namespace,
    };

    const { name, version } = metadata;
    const { data: dtoData } = extractDto(command);
    const { correlationId, delay, meta = {} } = options;

    const id = randomUUID();

    const message = this.commandQueue.create({
      id,
      aggregate,
      causationId: id,
      correlationId: correlationId ?? null,
      data: dtoData,
      meta,
      name,
      version,
    } as Partial<HermesCommandMessage>);

    this.logger.verbose("Publishing command", {
      command: name,
      aggregate,
    });

    await this.commandQueue.publish(message, delay ? { delay } : undefined);

    return aggregate;
  }

  // -- Query --

  public async query<R>(query: ClassLike): Promise<R> {
    this.assertReady();

    return this.viewDomain.query<R>(query);
  }

  // -- Event emitter delegation --

  public on(evt: HermesEventName, callback: (data: unknown) => void): void {
    if (evt.startsWith("saga")) {
      this.sagaDomain.on(evt, callback as any);
    } else if (evt.startsWith("view")) {
      this.viewDomain.on(evt, callback as any);
    } else if (evt.startsWith("checksum")) {
      this.checksumDomain.on(evt, callback as any);
    } else {
      throw new LindormError(
        `Unrecognized event prefix: "${evt}". Expected "saga", "view", or "checksum".`,
      );
    }
  }

  public off(evt: HermesEventName, callback: (data: unknown) => void): void {
    if (evt.startsWith("saga")) {
      this.sagaDomain.off(evt, callback as any);
    } else if (evt.startsWith("view")) {
      this.viewDomain.off(evt, callback as any);
    } else if (evt.startsWith("checksum")) {
      this.checksumDomain.off(evt, callback as any);
    } else {
      throw new LindormError(
        `Unrecognized event prefix: "${evt}". Expected "saga", "view", or "checksum".`,
      );
    }
  }

  // -- Admin inspect --

  private async inspectAggregate<S extends Dict = Dict>(opts: {
    id: string;
    name: string;
    namespace?: string;
  }): Promise<AggregateState<S>> {
    this.assertReady();

    const model = await this.aggregateDomain.inspect<S>({
      id: opts.id,
      name: opts.name,
      namespace: opts.namespace ?? this.namespace,
    });

    return model.toJSON() as AggregateState<S>;
  }

  private async inspectSaga<S extends Dict = Dict>(opts: {
    id: string;
    name: string;
    namespace?: string;
  }): Promise<SagaState<S> | null> {
    this.assertReady();

    const record = await this.sagaDomain.inspect({
      id: opts.id,
      name: opts.name,
      namespace: opts.namespace ?? this.namespace,
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      namespace: record.namespace,
      destroyed: record.destroyed,
      messagesToDispatch: record.messagesToDispatch,
      revision: record.revision,
      state: record.state as S,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async inspectView<V extends HermesViewEntity>(opts: {
    id: string;
    entity: Constructor<V>;
  }): Promise<V | null> {
    this.assertReady();

    return this.viewDomain.inspect<V>(opts.id, opts.entity);
  }

  // -- Admin purge --

  private async purgeCausations(): Promise<number> {
    this.assertReady();

    let totalPurged = 0;

    const mainRepo = this.proteus.repository(CausationRecord);
    const mainBefore = await mainRepo.count();
    await mainRepo.deleteExpired();
    const mainAfter = await mainRepo.count();
    totalPurged += mainBefore - mainAfter;

    for (const [, source] of this.viewSourceMap) {
      const viewRepo = source.repository(CausationRecord);
      const viewBefore = await viewRepo.count();
      await viewRepo.deleteExpired();
      const viewAfter = await viewRepo.count();
      totalPurged += viewBefore - viewAfter;
    }

    return totalPurged;
  }

  // -- Admin replay --

  /**
   * Replays all events for the given view entity by truncating the view table
   * and re-processing every stored event in temporal order. Cancelling
   * mid-replay leaves the view in a partially populated state -- the only
   * recovery is to re-run the replay to completion.
   */
  private replayView<V extends HermesViewEntity>(
    entity: Constructor<V>,
    _options: ReplayOptions = {},
  ): ReplayHandle {
    this.assertReady();

    const emitter = new EventEmitter();
    let cancelled = false;

    const cancel = async (): Promise<void> => {
      cancelled = true;
    };

    const work = async (): Promise<void> => {
      // Yield to let callers register listeners before events fire
      await Promise.resolve();

      const view = this.registry.getViewByEntity(entity as unknown as Constructor);
      const viewSource = this.resolveSourceForView(view);

      this.logger.verbose("Starting view replay", {
        view: { name: view.name, namespace: view.namespace },
      });

      // 1. Pause: unsubscribe view from event bus
      const subscriptions = this.viewDomain.getSubscriptionTopicsForView(view);

      for (const sub of subscriptions) {
        await this.eventBus.unsubscribe({ topic: sub.topic, queue: sub.queue });
      }

      emitter.emit("progress", {
        phase: "truncating",
        processed: 0,
        total: 0,
        percent: 0,
        skipped: 0,
      } satisfies ReplayProgress);

      // 2. Build combined filter for all aggregates (cross-aggregate temporal ordering)
      const eventRepo = this.proteus.repository(EventRecord);
      const aggregateFilters = view.aggregates.map((a) => ({
        aggregateName: a.name,
        aggregateNamespace: a.namespace,
      }));

      const combinedFilter =
        aggregateFilters.length === 1 ? aggregateFilters[0] : { $or: aggregateFilters };

      const total = await eventRepo.count(combinedFilter as any);

      // 3. Truncate the view table
      const viewRepo = viewSource.repository(view.entity);
      await viewRepo.clear();

      // 4. Delete related causation records from the source that stores them
      const causationSource = viewSource === this.proteus ? this.proteus : viewSource;
      const causationRepo = causationSource.repository(CausationRecord);
      const ownerName = `${view.namespace}.${view.name}`;
      await causationRepo.delete({ ownerName } as any);

      if (cancelled) {
        await this.resumeViewSubscriptions(view, subscriptions);
        emitter.emit("progress", {
          phase: "complete",
          processed: 0,
          total,
          percent: 0,
          skipped: 0,
        } satisfies ReplayProgress);
        emitter.emit("complete");
        return;
      }

      // 5 + 6. Stream events in batches and process through handlers
      emitter.emit("progress", {
        phase: "replaying",
        processed: 0,
        total,
        percent: 0,
        skipped: 0,
      } satisfies ReplayProgress);

      const BATCH_SIZE = 1000;
      let processed = 0;
      let skipped = 0;
      let offset = 0;
      let batch: Array<EventRecord>;

      do {
        batch = await eventRepo.find(combinedFilter as any, {
          order: { createdAt: "ASC" },
          limit: BATCH_SIZE,
          offset,
        });

        for (const eventRecord of batch) {
          if (cancelled) break;

          try {
            assertChecksum(eventRecord);
          } catch (checksumErr: any) {
            if (this.checksumMode === "strict") {
              throw new ChecksumError(
                `Checksum verification failed during replay for event ${eventRecord.id} ` +
                  `(aggregate ${eventRecord.aggregateId}): ${checksumErr.message}`,
              );
            }

            this.logger.warn("Skipping tampered event during replay", checksumErr, [
              {
                eventId: eventRecord.id,
                aggregateId: eventRecord.aggregateId,
                eventName: eventRecord.name,
              },
            ]);

            skipped++;
            processed++;

            const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
            const interval = total >= 100 ? Math.max(1, Math.floor(total / 100)) : 10;

            if (processed % interval === 0 || processed === total) {
              emitter.emit("progress", {
                phase: "replaying",
                processed,
                total,
                percent,
                skipped,
              } satisfies ReplayProgress);
            }

            continue;
          }

          const message = this.eventBus.create({
            id: eventRecord.id,
            aggregate: {
              id: eventRecord.aggregateId,
              name: eventRecord.aggregateName,
              namespace: eventRecord.aggregateNamespace,
            },
            causationId: eventRecord.causationId,
            correlationId: eventRecord.correlationId,
            data: eventRecord.data,
            meta: eventRecord.meta,
            name: eventRecord.name,
            version: eventRecord.version,
          } as Partial<HermesEventMessage>);

          await this.viewDomain.replayEvent(message, view);
          processed++;

          const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
          const interval = total >= 100 ? Math.max(1, Math.floor(total / 100)) : 10;

          if (processed % interval === 0 || processed === total) {
            emitter.emit("progress", {
              phase: "replaying",
              processed,
              total,
              percent,
              skipped,
            } satisfies ReplayProgress);
          }
        }

        offset += batch.length;
      } while (batch.length === BATCH_SIZE && !cancelled);

      // 7. Resume event consumption
      emitter.emit("progress", {
        phase: "resuming",
        processed,
        total,
        percent: total > 0 ? Math.round((processed / total) * 100) : 100,
        skipped,
      } satisfies ReplayProgress);

      await this.resumeViewSubscriptions(view, subscriptions);

      // 8. Complete
      emitter.emit("progress", {
        phase: "complete",
        processed,
        total,
        percent: total > 0 ? Math.round((processed / total) * 100) : 100,
        skipped,
      } satisfies ReplayProgress);

      emitter.emit("complete");

      this.logger.verbose("View replay complete", {
        view: { name: view.name, namespace: view.namespace },
        processed,
        total,
        skipped,
      });
    };

    const promise = work().catch((err) => {
      emitter.emit("error", err);
      throw err;
    });

    return {
      on: (event: string, callback: (...args: any[]) => void): void => {
        emitter.on(event, callback);
      },
      cancel,
      promise,
    };
  }

  /**
   * Replays all views associated with the given aggregate class. Each view is
   * replayed via {@link replayView}, which truncates the view table first.
   * Cancelling mid-replay leaves affected views partially populated -- re-run
   * the replay to recover.
   */
  private replayAggregate(
    aggregate: Constructor,
    options: ReplayOptions = {},
  ): ReplayHandle {
    this.assertReady();

    const emitter = new EventEmitter();
    let cancelled = false;

    const cancel = async (): Promise<void> => {
      cancelled = true;
    };

    const work = async (): Promise<void> => {
      // Yield to let callers register listeners before events fire
      await Promise.resolve();

      const registeredAggregate = this.registry.getAggregateByTarget(aggregate);

      const views = this.registry.allViews.filter((v) =>
        v.aggregates.some(
          (a) =>
            a.name === registeredAggregate.name &&
            a.namespace === registeredAggregate.namespace,
        ),
      );

      if (views.length === 0) {
        emitter.emit("progress", {
          phase: "complete",
          processed: 0,
          total: 0,
          percent: 100,
          skipped: 0,
        } satisfies ReplayProgress);
        emitter.emit("complete");
        return;
      }

      for (const view of views) {
        if (cancelled) break;

        const handle = this.replayView(view.entity, options);

        handle.on("progress", (p: ReplayProgress) => {
          emitter.emit("progress", p);
        });

        handle.on("error", (err: Error) => {
          emitter.emit("error", err);
        });

        await handle.promise;
      }

      if (!cancelled) {
        emitter.emit("complete");
      }
    };

    const promise = work().catch((err) => {
      emitter.emit("error", err);
      throw err;
    });

    return {
      on: (event: string, callback: (...args: any[]) => void): void => {
        emitter.on(event, callback);
      },
      cancel,
      promise,
    };
  }

  private async resumeViewSubscriptions(
    view: { name: string; namespace: string; target: Constructor },
    subscriptions: Array<{ topic: string; queue: string }>,
  ): Promise<void> {
    const registeredView = this.registry.getView(view.namespace, view.name);

    for (const sub of subscriptions) {
      const handler = registeredView.eventHandlers.find((h) => {
        const eventDto = this.registry.getEvent(h.trigger);
        const aggregate = this.registry.getAggregateForEvent(
          h.trigger,
          registeredView.aggregates,
        );
        return sub.topic === `${aggregate.namespace}.${aggregate.name}.${eventDto.name}`;
      });

      if (handler) {
        await this.eventBus.subscribe({
          topic: sub.topic,
          queue: sub.queue,
          callback: async (message) =>
            (this.viewDomain as any).handleEvent(message, registeredView, handler),
        });
      }
    }
  }

  // -- Setup helpers --

  private registerEntities(): void {
    this.logger.debug("Registering internal entities with proteus");

    this.proteus.addEntities([
      EventRecord,
      SagaRecord,
      CausationRecord,
      ChecksumRecord,
      EncryptionRecord,
    ]);

    const viewSourcesWithCausation = new Set<IProteusSource>();

    for (const view of this.registry.allViews) {
      const source = this.resolveSourceForView(view);

      this.logger.debug("Registering view entity", {
        view: view.name,
        entity: view.entity.name,
        source: view.driverType ?? "default",
      });

      source.addEntities([view.entity]);

      if (source !== this.proteus && !viewSourcesWithCausation.has(source)) {
        viewSourcesWithCausation.add(source);
        source.addEntities([CausationRecord]);

        this.logger.debug("Registering CausationRecord on view source", {
          driverType: view.driverType,
        });
      }
    }
  }

  private registerIrisMessages(): void {
    this.logger.debug("Registering Iris messages");

    this.iris.addMessages([
      HermesCommandMessage,
      HermesErrorMessage,
      HermesEventMessage,
      HermesTimeoutMessage,
    ]);
  }

  private async setupSources(): Promise<void> {
    this.logger.debug("Setting up proteus sources");

    await this.proteus.setup();

    for (const [driverType, source] of this.viewSourceMap) {
      this.logger.debug("Setting up view source", { driverType });
      await source.setup();
    }
  }

  private async setupIris(): Promise<void> {
    this.logger.debug("Setting up iris");

    await this.iris.setup();
  }

  private createIrisPrimitives(): void {
    this.logger.debug("Creating Iris primitives");

    this.commandQueue = this.iris.workerQueue(HermesCommandMessage);
    this.eventBus = this.iris.messageBus(HermesEventMessage);
    this.errorQueue = this.iris.workerQueue(HermesErrorMessage);
    this.timeoutQueue = this.iris.workerQueue(HermesTimeoutMessage);
  }

  private createDomains(): void {
    this.logger.debug("Creating domains");

    this.aggregateDomain = new AggregateDomain({
      registry: this.registry,
      proteus: this.proteus,
      iris: {
        commandQueue: this.commandQueue,
        eventBus: this.eventBus,
        errorQueue: this.errorQueue,
      },
      encryption: this.options.encryption,
      checksumMode: this.options.checksumMode,
      logger: this.logger,
    });

    this.checksumDomain = new ChecksumDomain({
      registry: this.registry,
      proteus: this.proteus,
      iris: {
        eventBus: this.eventBus,
        errorQueue: this.errorQueue,
      },
      logger: this.logger,
    });

    this.sagaDomain = new SagaDomain({
      registry: this.registry,
      proteusSource: this.proteus,
      eventBus: this.eventBus,
      commandQueue: this.commandQueue,
      timeoutQueue: this.timeoutQueue,
      errorQueue: this.errorQueue,
      causationExpiryMs: this.causationExpiryMs,
      logger: this.logger,
    });

    this.viewDomain = new ViewDomain({
      registry: this.registry,
      proteusSource: this.proteus,
      viewSources: this.viewSourceMap,
      eventBus: this.eventBus,
      commandQueue: this.commandQueue,
      errorQueue: this.errorQueue,
      causationExpiryMs: this.causationExpiryMs,
      logger: this.logger,
    });
  }

  private async registerDomainHandlers(): Promise<void> {
    this.logger.debug("Registering domain handlers");

    await this.aggregateDomain.registerHandlers();
    await this.checksumDomain.registerHandlers();
    await this.sagaDomain.registerHandlers();
    await this.viewDomain.registerHandlers();
  }

  private resolveSourceForView(view: {
    name: string;
    namespace: string;
    driverType: string | null;
  }): IProteusSource {
    if (!view.driverType) {
      return this.proteus;
    }

    const source = this.viewSourceMap.get(view.driverType);

    if (!source) {
      throw new LindormError(
        `No ProteusSource found for driver type "${view.driverType}" (required by view "${view.namespace}.${view.name}")`,
      );
    }

    return source;
  }

  // -- Guard --

  private assertReady(): void {
    if (this._statusRef.current !== "ready") {
      throw new LindormError("Hermes is not ready", {
        data: { status: this._statusRef.current },
      });
    }
  }
}
