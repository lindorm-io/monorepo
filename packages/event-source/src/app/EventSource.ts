import { IMessageBus } from "@lindorm-io/amqp";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { StructureScanner } from "@lindorm-io/structure-scanner";
import { randomUUID } from "crypto";
import { join } from "path";
import {
  AggregateDomain,
  ErrorDomain,
  QueryDomain,
  ReplayDomain,
  SagaDomain,
  ViewDomain,
} from "../domain";
import { ChecksumDomain } from "../domain/ChecksumDomain";
import { ReplayEventName } from "../enum";
import { EventStore, MessageBus, SagaStore, ViewStore } from "../infrastructure";
import { ChecksumStore } from "../infrastructure/ChecksumStore";
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
  IChecksumDomain,
  IDomainChecksumStore,
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

  // domains
  private readonly aggregateDomain: IAggregateDomain;
  private readonly checksumDomain: IChecksumDomain;
  private readonly errorDomain: IErrorDomain;
  private readonly queryDomain: IQueryDomain;
  private readonly replayDomain: IReplayDomain;
  private readonly sagaDomain: ISagaDomain;
  private readonly viewDomain: IViewDomain;

  // stores
  private readonly checksumStore: IDomainChecksumStore;
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
    this.options = {
      checksumStore: {
        type: "memory",
        ...(options.checksumStore || {}),
      },
      context: options.context || "default",
      dangerouslyRegisterHandlersManually: options.dangerouslyRegisterHandlersManually === true,
      directories: {
        aggregates: join(__dirname, "aggregates"),
        queries: join(__dirname, "queries"),
        sagas: join(__dirname, "sagas"),
        views: join(__dirname, "views"),
        ...(options.directories || {}),
      },
      eventStore: {
        type: "memory",
        ...(options.eventStore || {}),
      },
      fileFilter: {
        include: [/.*/],
        exclude: [],
        ...(options.fileFilter || {}),
      },
      messageBus: {
        type: "memory",
        ...(options.messageBus || {}),
      },
      require: options.require || require,
      sagaStore: {
        type: "memory",
        ...(options.sagaStore || {}),
      },
      scanner: {
        deniedDirectories: [],
        deniedExtensions: [],
        deniedFilenames: [],
        deniedTypes: [/^spec$/, /^test$/],
        ...(options.scanner || {}),
      },
      viewStore: {
        ...(options.viewStore || {}),
      },
    };

    this.logger = logger.createChildLogger(["EventSource"]);
    this.adapters = [];
    this.scanner = new EventSourceScanner(this.options, this.logger);
    this.status = "created";

    // bus

    this.messageBus = new MessageBus(this.options.messageBus, this.logger);

    // stores

    this.checksumStore = new ChecksumStore(this.options.checksumStore, this.logger);
    this.eventStore = new EventStore(this.options.eventStore, this.logger);
    this.sagaStore = new SagaStore(this.options.sagaStore, this.logger);
    this.viewStore = new ViewStore(this.options.viewStore, this.logger);

    // domains

    this.aggregateDomain = new AggregateDomain(
      {
        messageBus: this.messageBus,
        store: this.eventStore,
      },
      this.logger,
    );

    this.checksumDomain = new ChecksumDomain(
      {
        messageBus: this.messageBus,
        store: this.checksumStore,
      },
      this.logger,
    );

    this.errorDomain = new ErrorDomain(this.messageBus, this.logger);

    this.queryDomain = new QueryDomain(this.options.viewStore, this.logger);

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
      registerChecksumEventHandler: this.checksumDomain.registerEventHandler.bind(
        this.checksumDomain,
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

    if (this.options.messageBus.amqp) {
      await this.options.messageBus.amqp.connect();
    }

    if (this.options.checksumStore.mongo) {
      await this.options.checksumStore.mongo.connect();
    }
    if (this.options.checksumStore.postgres) {
      await this.options.checksumStore.postgres.connect();
    }

    if (this.options.eventStore.mongo) {
      await this.options.eventStore.mongo.connect();
    }
    if (this.options.eventStore.postgres) {
      await this.options.eventStore.postgres.connect();
    }

    if (this.options.sagaStore.mongo) {
      await this.options.sagaStore.mongo.connect();
    }
    if (this.options.sagaStore.postgres) {
      await this.options.sagaStore.postgres.connect();
    }

    if (this.options.viewStore.mongo) {
      await this.options.viewStore.mongo.connect();
    }
    if (this.options.viewStore.postgres) {
      await this.options.viewStore.postgres.connect();
    }

    if (!this.options.dangerouslyRegisterHandlersManually) {
      if (!StructureScanner.hasFiles(this.options.directories.aggregates)) {
        throw new Error(`No files found at directory [ ${this.options.directories.aggregates} ]`);
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

      for (const handler of this.scanner.checksumEventHandlers) {
        await this.checksumDomain.registerEventHandler(handler);
      }

      for (const handler of this.scanner.errorHandlers) {
        await this.errorDomain.registerErrorHandler(handler);
      }

      for (const handler of this.scanner.queryHandlers) {
        this.queryDomain.registerQueryHandler(handler);
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
