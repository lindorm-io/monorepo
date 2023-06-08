import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { StructureScanner } from "@lindorm-io/structure-scanner";
import { randomUUID } from "crypto";
import merge from "deepmerge";
import { join } from "path";
import {
  AggregateDomain,
  ErrorDomain,
  QueryDomain,
  ReplayDomain,
  SagaDomain,
  ViewDomain,
} from "../domain";
import { ReplayEventName } from "../enum";
import { EventStore, MessageBus, SagaStore, ViewStore } from "../infrastructure";
import { Command } from "../message";
import { Aggregate, Saga, View } from "../model";
import { JOI_MESSAGE } from "../schema";
import {
  Data,
  DtoClass,
  EventEmitterListener,
  EventSourceAdmin,
  EventSourceCommandOptions,
  EventSourceCommandResult,
  EventSourceInspectOptions,
  EventSourceOptions,
  EventSourcePrivateOptions,
  EventSourceSetup,
  HandlerIdentifier,
  IAggregateDomain,
  IDomainEventStore,
  IDomainSagaStore,
  IDomainViewStore,
  IErrorDomain,
  IEventSource,
  IQueryDomain,
  IReplayDomain,
  ISagaDomain,
  IViewDomain,
  Metadata,
  State,
  ViewEventHandlerAdapter,
} from "../types";
import { extractDtoData } from "../util";
import { EventSourceScanner } from "./EventSourceScanner";

export class EventSource<TCommand extends DtoClass = DtoClass, TQuery extends DtoClass = DtoClass>
  implements IEventSource<TCommand, TQuery>
{
  // bus
  private readonly messageBus: IMessageBus;

  // connections
  private readonly amqp: IAmqpConnection | undefined;
  private readonly mongo: IMongoConnection | undefined;
  private readonly postgres: IPostgresConnection | undefined;

  // domains
  private readonly aggregateDomain: IAggregateDomain;
  private readonly errorDomain: IErrorDomain;
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
  private readonly logger: Logger;
  private readonly adapters: Array<HandlerIdentifier & ViewEventHandlerAdapter>;
  private status: "initialising" | "initialised" | "replaying" | "created";

  // promise
  private promise: () => Promise<void>;

  public constructor(options: EventSourceOptions, logger: Logger) {
    const { connections = {}, custom = {}, ...appOptions } = options;

    // defaults
    const defaultOptions: EventSourcePrivateOptions = {
      adapters: {
        eventStore: "memory",
        sagaStore: "memory",
        messageBus: "memory",
      },
      aggregates: join(__dirname, "aggregates"),
      context: "default",
      dangerouslyRegisterHandlersManually: false,
      fileFilter: {
        include: [/.*/],
        exclude: [],
      },
      queries: join(__dirname, "queries"),
      sagas: join(__dirname, "sagas"),
      scanner: {
        deniedDirectories: [],
        deniedExtensions: [],
        deniedFilenames: [],
        deniedTypes: [/^spec$/, /^test$/],
      },
      views: join(__dirname, "views"),
    };

    // primary
    this.logger = logger.createChildLogger(["EventSource"]);
    this.options = merge<EventSourcePrivateOptions, EventSourceOptions>(defaultOptions, appOptions);
    this.adapters = [];
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
        mongo: this.mongo,
        postgres: this.postgres,
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

    this.errorDomain = new ErrorDomain(this.messageBus, this.logger);

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
        view: this.inspectView.bind(this),
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
      registerErrorHandler: this.errorDomain.registerErrorHandler.bind(this.errorDomain),
      registerQueryHandler: this.queryDomain.registerQueryHandler.bind(this.queryDomain),
      registerSagaEventHandler: this.sagaDomain.registerEventHandler.bind(this.sagaDomain),
      registerViewEventHandler: this.viewDomain.registerEventHandler.bind(this.viewDomain),

      registerCommandAggregate: this.scanner.registerAggregateCommand.bind(this.scanner),
      registerViewAdapter: this.registerViewAdapter.bind(this),
    };
  }
  public set setup(_: EventSourceSetup) {
    /* ignored */
  }

  // public app

  public async command<TMetadata extends Metadata = Metadata>(
    command: TCommand,
    options: EventSourceCommandOptions<TMetadata> = {},
  ): Promise<EventSourceCommandResult> {
    await this.promise();

    const { name, version, data } = extractDtoData(command);
    const { correlationId, delay, metadata } = options;

    const aggregate = {
      id: data.aggregateId || options.aggregate?.id || randomUUID(),
      name: options.aggregate?.name || this.scanner.getAggregateFromCommand(name),
      context: this.scanner.context(options.aggregate?.context),
    };

    const generated = new Command({
      aggregate,
      correlationId,
      data,
      delay,
      metadata,
      name,
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
      aggregate,
      result: this.isReplaying ? "QUEUED" : "OK",
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

  private async inspectView<TState extends State = State>(
    view: EventSourceInspectOptions,
  ): Promise<View<TState>> {
    await this.promise();

    const viewIdentifier = {
      id: view.id,
      name: view.name,
      context: this.scanner.context(view.context),
    };

    const adapter = this.adapters.find(
      (x) => x.name === viewIdentifier.name && x.context === viewIdentifier.context,
    );

    if (!adapter) {
      throw new LindormError("Adapter not found", {
        data: { viewIdentifier },
      });
    }

    return this.viewDomain.inspect<TState>(viewIdentifier, adapter);
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
      await this.scanner.scanSagas();
      await this.scanner.scanViews();
      await this.scanner.scanQueries();

      for (const handler of this.scanner.aggregateCommandHandlers) {
        await this.aggregateDomain.registerCommandHandler(handler);
      }

      for (const handler of this.scanner.aggregateEventHandlers) {
        await this.aggregateDomain.registerEventHandler(handler);
      }

      for (const handler of this.scanner.errorHandlers) {
        await this.errorDomain.registerErrorHandler(handler);
      }

      for (const handler of this.scanner.queryHandlers) {
        await this.queryDomain.registerQueryHandler(handler);
      }

      for (const handler of this.scanner.sagaEventHandlers) {
        await this.sagaDomain.registerEventHandler(handler);
      }

      for (const handler of this.scanner.viewEventHandlers) {
        await this.viewDomain.registerEventHandler(handler);
        this.registerViewAdapter({ ...handler.view, ...handler.adapter });
      }
    }

    await this.setupReplayDomain();

    this.status = "initialised";
    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private registerViewAdapter(adapter: HandlerIdentifier & ViewEventHandlerAdapter): void {
    this.adapters.push(adapter);
  }

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
