import { Aggregate, Saga } from "../model";
import { AggregateDomain, QueryDomain, ReplayDomain, SagaDomain, ViewDomain } from "../domain";
import { Command } from "../message";
import { EventSourceScanner } from "./EventSourceScanner";
import { EventStore, MessageBus, SagaStore, ViewStore } from "../infrastructure";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { JOI_MESSAGE } from "../schema";
import { LindormError } from "@lindorm-io/errors";
import { ReplayEventName } from "../enum";
import { extractDtoData, StructureScanner } from "../util";
import { join } from "path";
import { merge } from "lodash";
import { randomUUID } from "crypto";
import {
  EventSourceAdmin,
  EventSourceInspectOptions,
  EventSourcePublishOptions,
  EventSourcePublishResult,
  Data,
  DtoClass,
  EventEmitterListener,
  EventSourceOptions,
  EventSourceSetup,
  IAggregateDomain,
  IDomainEventStore,
  IDomainSagaStore,
  IDomainViewStore,
  IEventSource,
  IQueryDomain,
  IReplayDomain,
  ISagaDomain,
  IViewDomain,
  EventSourcePrivateOptions,
  State,
} from "../types";

export class EventSource<TCommand extends DtoClass = DtoClass, TQuery extends DtoClass = DtoClass>
  implements IEventSource<TCommand, TQuery>
{
  // bus
  private readonly messageBus: IMessageBus;

  // connections
  private readonly amqp: IAmqpConnection;
  private readonly mongo: IMongoConnection;
  private readonly postgres: IPostgresConnection;

  // domains
  private readonly aggregateDomain: IAggregateDomain;
  private readonly queryDomain: IQueryDomain;
  private readonly replayDomain: IReplayDomain;
  private readonly sagaDomain: ISagaDomain;
  private readonly viewDomain: IViewDomain;

  // stores
  private readonly eventStore: IDomainEventStore;
  private readonly sagaStore: IDomainSagaStore;
  private readonly viewStore: IDomainViewStore;

  // primary
  private readonly scanner: EventSourceScanner;
  private readonly options: EventSourcePrivateOptions;
  private readonly logger: ILogger;
  private status: "initialising" | "initialised" | "replaying" | "created";

  // promise
  private promise: () => Promise<void>;

  public constructor(options: EventSourceOptions, logger: ILogger) {
    const { connections = {}, custom = {}, ...appOptions } = options;

    // primary
    this.logger = logger.createChildLogger(["EventSource"]);
    this.options = merge<Partial<EventSourcePrivateOptions>, EventSourcePrivateOptions>(
      {
        adapters: {
          eventStore: "memory",
          sagaStore: "memory",
          viewStore: "memory",
          messageBus: "memory",
        },
        context: "default",
        aggregates: join(__dirname, "aggregates"),
        queries: join(__dirname, "queries"),
        scanner: {
          extensions: [".js", ".ts"],
          include: [/.*/],
          exclude: [],
        },
        dangerouslyRegisterHandlersManually: false,
      },
      appOptions,
    );
    this.scanner = new EventSourceScanner(this.options, custom, this.logger);
    this.status = "created";

    // connections
    this.amqp = connections.amqp;
    this.mongo = connections.mongo;
    this.postgres = connections.postgres;

    // bus
    this.messageBus = new MessageBus(
      {
        amqp: this.amqp,
        custom: custom.messageBus,
        type: this.options.adapters.messageBus,
      },
      this.logger,
    );

    // stores
    this.eventStore = new EventStore(
      {
        custom: custom.eventStore,
        mongo: this.mongo,
        postgres: this.postgres,
        type: this.options.adapters.eventStore,
      },
      this.logger,
    );
    this.sagaStore = new SagaStore(
      {
        custom: custom.sagaStore,
        mongo: this.mongo,
        postgres: this.postgres,
        type: this.options.adapters.sagaStore,
      },
      this.logger,
    );
    this.viewStore = new ViewStore(
      {
        custom: custom.viewStore,
        mongo: this.mongo,
        postgres: this.postgres,
        type: this.options.adapters.viewStore,
      },
      this.logger,
    );

    // domains
    this.aggregateDomain = new AggregateDomain(
      {
        messageBus: this.messageBus,
        store: this.eventStore,
      },
      this.logger,
    );
    this.queryDomain = new QueryDomain(
      {
        mongo: this.mongo,
        postgres: this.postgres,
      },
      this.logger,
    );
    this.replayDomain = new ReplayDomain(
      {
        messageBus: this.messageBus,
        eventStore: this.eventStore,
        context: this.options.context,
      },
      this.logger,
    );
    this.sagaDomain = new SagaDomain(
      {
        messageBus: this.messageBus,
        store: this.sagaStore,
      },
      this.logger,
    );
    this.viewDomain = new ViewDomain(
      {
        messageBus: this.messageBus,
        store: this.viewStore,
      },
      this.logger,
    );

    this.promise = this.handleInitialisation;
  }

  // public properties

  public get isInitialised(): boolean {
    return this.status === "initialised";
  }
  public set isInitialised(_: boolean) {
    /* ignored */
  }

  public get isInitialising(): boolean {
    return this.status === "initialising";
  }
  public set isInitialising(_: boolean) {
    /* ignored */
  }

  public get isReplaying(): boolean {
    return this.status === "replaying";
  }
  public set isReplaying(_: boolean) {
    /* ignored */
  }

  public get admin(): EventSourceAdmin {
    return {
      inspect: {
        aggregate: this.inspectAggregate.bind(this),
        saga: this.inspectSaga.bind(this),
      },
      replay: async () => undefined, // this.replay.bind(this),
    };
  }
  public set admin(_: EventSourceAdmin) {
    /* ignored */
  }

  public get setup(): EventSourceSetup {
    return {
      registerAggregateCommandHandler: this.aggregateDomain.registerCommandHandler.bind(
        this.aggregateDomain,
      ),
      registerAggregateEventHandler: this.aggregateDomain.registerEventHandler.bind(
        this.aggregateDomain,
      ),
      registerCommandAggregate: this.scanner.registerCommandAggregate.bind(this.scanner),
      registerQueryHandler: this.queryDomain.registerQueryHandler.bind(this.queryDomain),
      registerSagaEventHandler: this.sagaDomain.registerEventHandler.bind(this.sagaDomain),
      registerViewEntity: this.queryDomain.registerViewEntity.bind(this.queryDomain),
      registerViewEventHandler: this.viewDomain.registerEventHandler.bind(this.viewDomain),
    };
  }
  public set setup(_: EventSourceSetup) {
    /* ignored */
  }

  // public app

  public async publish(
    command: TCommand,
    options: EventSourcePublishOptions = {},
  ): Promise<EventSourcePublishResult> {
    await this.promise();

    const { name, version, data } = extractDtoData(command);
    const aggregateName = this.scanner.getCommandAggregate(name);

    const resolvedAggregate = {
      id: data.aggregateId || options.aggregate?.id || randomUUID(),
      name: options.aggregate?.name || aggregateName,
      context: this.scanner.context(options.aggregate?.context),
    };

    const generated = new Command({
      aggregate: resolvedAggregate,
      name,
      data,
      correlationId: options.correlationId,
      delay: options.delay,
      origin: options.origin || "event_source",
      originId: options.originId,
      version,
    });

    await JOI_MESSAGE.validateAsync(generated);

    if (!(generated instanceof Command)) {
      throw new LindormError("Invalid operation", {
        data: {
          expect: "Command",
          actual: typeof generated,
        },
      });
    }

    await this.messageBus.publish(generated);

    return {
      result: this.isReplaying ? "QUEUED" : "OK",
      aggregate: resolvedAggregate,
    };
  }

  public async query<TResult>(query: TQuery): Promise<TResult> {
    await this.promise();

    return this.queryDomain.query(query);
  }

  public on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void {
    if (evt.startsWith("replay")) {
      this.replayDomain.on(evt, listener);
    }

    if (evt.startsWith("saga")) {
      this.sagaDomain.on(evt, listener);
    }

    if (evt.startsWith("view")) {
      this.viewDomain.on(evt, listener);
    }
  }

  public async init(): Promise<void> {
    await this.promise();
  }

  public async initialise(): Promise<void> {
    await this.promise();
  }

  // private admin

  private async inspectAggregate<TState extends State = State>(
    aggregate: EventSourceInspectOptions,
  ): Promise<Aggregate<TState>> {
    await this.promise();

    return this.aggregateDomain.inspect<TState>({
      id: aggregate.id,
      name: aggregate.name,
      context: this.scanner.context(aggregate.context),
    });
  }

  private async inspectSaga<TState extends State = State>(
    saga: EventSourceInspectOptions,
  ): Promise<Saga<TState>> {
    await this.promise();

    return this.sagaDomain.inspect<TState>({
      id: saga.id,
      name: saga.name,
      context: this.scanner.context(saga.context),
    });
  }

  // private initialisation handler

  private async handleInitialisation(): Promise<void> {
    this.status = "initialising";

    if (this.amqp) await this.amqp.connect();
    if (this.mongo) await this.mongo.connect();
    if (this.postgres) await this.postgres.connect();

    if (!this.options.dangerouslyRegisterHandlersManually) {
      if (!StructureScanner.hasFiles(this.options.aggregates)) {
        throw new Error(`No files found at directory [ ${this.options.aggregates} ]`);
      }

      await this.scanner.scanAggregates();
      await this.scanner.scanQueries();

      for (const handler of this.scanner.aggregateCommandHandlers) {
        await this.aggregateDomain.registerCommandHandler(handler);
      }
      for (const handler of this.scanner.aggregateEventHandlers) {
        await this.aggregateDomain.registerEventHandler(handler);
      }
      for (const handler of this.scanner.queryHandlers) {
        await this.queryDomain.registerQueryHandler(handler);
      }
      for (const handler of this.scanner.sagaEventHandlers) {
        await this.sagaDomain.registerEventHandler(handler);
      }
      for (const handler of this.scanner.viewEventHandlers) {
        await this.viewDomain.registerEventHandler(handler);
        this.queryDomain.registerViewEntity(handler.view, handler.adapters?.postgres?.ViewEntity);
      }
    }

    await this.setupReplayDomain();

    this.status = "initialised";
    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private async setupReplayDomain(): Promise<void> {
    this.replayDomain.on(ReplayEventName.START, this.onReplayStart.bind(this));
    this.replayDomain.on(ReplayEventName.STOP, this.onReplayStop.bind(this));

    await this.replayDomain.subscribe();
  }

  // private event listeners

  private onReplayStart(): void {
    this.status = "replaying";

    this.aggregateDomain
      .unsubscribeCommandHandlers()
      .then(() => {
        this.logger.verbose("Removed registry");
      })
      .catch((err) => {
        this.logger.error("Failed to remove registry", err);
      });
  }

  private onReplayStop(): void {
    this.aggregateDomain
      .resubscribeCommandHandlers()
      .then(() => {
        this.logger.verbose("Registered registry");
        this.status = "initialised";
      })
      .catch((err) => {
        this.logger.error("Failed to register registry", err);
      });
  }
}
