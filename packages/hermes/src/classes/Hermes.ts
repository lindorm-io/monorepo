import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Scanner } from "@lindorm/scanner";
import { ClassLike, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { join } from "path";
import {
  AggregateDomain,
  ChecksumDomain,
  ErrorDomain,
  QueryDomain,
  SagaDomain,
  ViewDomain,
} from "../domains";
import { HermesStatus } from "../enums";
import {
  ChecksumStore,
  EncryptionStore,
  EventStore,
  MessageBus,
  SagaStore,
  ViewStore,
} from "../infrastructure";
import {
  IAggregate,
  IAggregateDomain,
  IChecksumDomain,
  IErrorDomain,
  IEventStore,
  IHermes,
  IHermesChecksumStore,
  IHermesEncryptionStore,
  IHermesMessageBus,
  IHermesSagaStore,
  IHermesViewStore,
  IQueryDomain,
  ISaga,
  ISagaDomain,
  IView,
  IViewDomain,
} from "../interfaces";
import { HermesCommand } from "../messages";
import { HermesMessageSchema } from "../schemas";
import {
  AggregateIdentifier,
  CloneHermesOptions,
  EventEmitterListener,
  HandlerIdentifier,
  HermesAdmin,
  HermesCommandOptions,
  HermesConfig,
  HermesInspectOptions,
  HermesOptions,
  ViewEventHandlerAdapter,
} from "../types";
import { FromClone } from "../types/private";
import { extractDataTransferObject } from "../utils/private";
import { HermesScanner } from "./private/HermesScanner";

export class Hermes<C extends ClassLike = ClassLike, Q extends ClassLike = ClassLike>
  implements IHermes<C, Q>
{
  // domains
  private readonly aggregateDomain: IAggregateDomain;
  private readonly checksumDomain: IChecksumDomain;
  private readonly errorDomain: IErrorDomain;
  private readonly queryDomain: IQueryDomain;
  private readonly sagaDomain: ISagaDomain;
  private readonly viewDomain: IViewDomain;

  // infrastructure
  private readonly checksumStore: IHermesChecksumStore;
  private readonly encryptionStore: IHermesEncryptionStore;
  private readonly eventStore: IEventStore;
  private readonly messageBus: IHermesMessageBus;
  private readonly sagaStore: IHermesSagaStore;
  private readonly viewStore: IHermesViewStore;

  // primary
  private readonly scanner: HermesScanner;
  private readonly options: HermesConfig;
  private readonly logger: ILogger;
  private readonly adapters: Array<HandlerIdentifier & ViewEventHandlerAdapter>;

  private _status: HermesStatus;

  public constructor(options: HermesOptions);
  public constructor(options: FromClone);
  public constructor(options: HermesOptions | FromClone) {
    this.logger = options.logger.child(["Hermes"]);

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.aggregateDomain = opts.aggregateDomain;
      this.checksumDomain = opts.checksumDomain;
      this.errorDomain = opts.errorDomain;
      this.queryDomain = opts.queryDomain;
      this.sagaDomain = opts.sagaDomain;
      this.viewDomain = opts.viewDomain;

      this.checksumStore = opts.checksumStore;
      this.encryptionStore = opts.encryptionStore;
      this.eventStore = opts.eventStore;
      this.messageBus = opts.messageBus;
      this.sagaStore = opts.sagaStore;
      this.viewStore = opts.viewStore;

      this.scanner = opts.scanner;
      this.options = opts.options;
      this.adapters = opts.adapters;

      this._status = opts.status;
    } else {
      const opts = options as HermesOptions;

      this.options = {
        checksumStore: opts.checksumStore ?? {},
        context: opts.context ?? "default",
        dangerouslyRegisterHandlersManually:
          opts.dangerouslyRegisterHandlersManually === true,
        directories: {
          aggregates: join(__dirname, "aggregates"),
          queries: join(__dirname, "queries"),
          sagas: join(__dirname, "sagas"),
          views: join(__dirname, "views"),
          ...(opts.directories ?? {}),
        },
        encryptionStore: opts.encryptionStore ?? {},
        eventStore: opts.eventStore ?? {},
        fileFilter: {
          include: [/.*/],
          exclude: [],
          ...(opts.fileFilter ?? {}),
        },
        messageBus: opts.messageBus ?? {},
        sagaStore: opts.sagaStore ?? {},
        scanner: {
          deniedDirectories: [],
          deniedExtensions: [],
          deniedFilenames: [],
          deniedTypes: [/^spec$/, /^test$/],
          ...(opts.scanner ?? {}),
        },
        viewStore: opts.viewStore ?? {},
      };

      this._status = HermesStatus.Created;

      this.adapters = [];
      this.scanner = new HermesScanner(this.options, this.logger);

      // infrastructure

      this.checksumStore = new ChecksumStore({
        ...this.options.checksumStore,
        logger: this.logger,
      });
      this.encryptionStore = new EncryptionStore({
        ...this.options.encryptionStore,
        logger: this.logger,
      });
      this.eventStore = new EventStore({
        ...this.options.eventStore,
        logger: this.logger,
      });
      this.messageBus = new MessageBus({
        ...this.options.messageBus,
        logger: this.logger,
      });
      this.sagaStore = new SagaStore({
        ...this.options.sagaStore,
        logger: this.logger,
      });
      this.viewStore = new ViewStore({
        ...this.options.viewStore,
        logger: this.logger,
      });

      // domains

      this.aggregateDomain = new AggregateDomain({
        messageBus: this.messageBus,
        encryptionStore: this.encryptionStore,
        eventStore: this.eventStore,
        logger: this.logger,
      });
      this.checksumDomain = new ChecksumDomain({
        messageBus: this.messageBus,
        store: this.checksumStore,
        logger: this.logger,
      });
      this.errorDomain = new ErrorDomain({
        messageBus: this.messageBus,
        logger: this.logger,
      });
      this.queryDomain = new QueryDomain({
        ...this.options.viewStore,
        logger: this.logger,
      });
      this.sagaDomain = new SagaDomain({
        messageBus: this.messageBus,
        store: this.sagaStore,
        logger: this.logger,
      });
      this.viewDomain = new ViewDomain({
        messageBus: this.messageBus,
        store: this.viewStore,
        logger: this.logger,
      });
    }
  }

  // public

  public get admin(): HermesAdmin {
    return {
      inspect: {
        aggregate: this.inspectAggregate.bind(this),
        saga: this.inspectSaga.bind(this),
        view: this.inspectView.bind(this),
      },
      register: {
        aggregateCommandHandler: this.aggregateDomain.registerCommandHandler.bind(
          this.aggregateDomain,
        ),
        aggregateEventHandler: this.aggregateDomain.registerEventHandler.bind(
          this.aggregateDomain,
        ),
        checksumEventHandler: this.checksumDomain.registerEventHandler.bind(
          this.checksumDomain,
        ),
        errorHandler: this.errorDomain.registerErrorHandler.bind(this.errorDomain),
        queryHandler: this.queryDomain.registerQueryHandler.bind(this.queryDomain),
        sagaEventHandler: this.sagaDomain.registerEventHandler.bind(this.sagaDomain),
        viewEventHandler: this.viewDomain.registerEventHandler.bind(this.viewDomain),
        commandAggregate: this.scanner.registerAggregateCommand.bind(this.scanner),
        viewAdapter: this.registerViewAdapter.bind(this),
      },
    };
  }

  public get status(): HermesStatus {
    return this._status;
  }

  public clone(options: CloneHermesOptions = {}): IHermes<C, Q> {
    return new Hermes<C, Q>({
      _mode: "from_clone",
      adapters: this.adapters,
      aggregateDomain: this.aggregateDomain,
      checksumDomain: this.checksumDomain,
      checksumStore: this.checksumStore,
      encryptionStore: this.encryptionStore,
      errorDomain: this.errorDomain,
      eventStore: this.eventStore,
      logger: options.logger ?? this.logger,
      messageBus: this.messageBus,
      options: this.options,
      queryDomain: this.queryDomain,
      sagaDomain: this.sagaDomain,
      sagaStore: this.sagaStore,
      scanner: this.scanner,
      status: this.status,
      viewDomain: this.viewDomain,
      viewStore: this.viewStore,
    });
  }

  public async command<M extends Dict = Dict>(
    command: C,
    options: HermesCommandOptions<M> = {},
  ): Promise<AggregateIdentifier> {
    if (this.status !== HermesStatus.Ready) {
      throw new LindormError("Invalid operation", {
        data: { status: this.status },
      });
    }

    const { name, version, data } = extractDataTransferObject(command);
    const { correlationId, delay, meta } = options;

    const aggregate = {
      id: data.aggregateId || options.aggregate?.id || randomUUID(),
      name: options.aggregate?.name || this.scanner.getAggregateFromCommand(name),
      context: this.scanner.context(options.aggregate?.context),
    };

    const generated = new HermesCommand({
      aggregate,
      correlationId,
      data,
      delay,
      meta,
      name,
      version,
    });

    HermesMessageSchema.parse(generated);

    if (!(generated instanceof HermesCommand)) {
      throw new LindormError("Invalid operation", {
        data: {
          expect: "Command",
          actual: typeof generated,
        },
      });
    }

    this.logger.verbose("Publishing command", { command: generated });

    await this.messageBus.publish(generated);

    return aggregate;
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    if (evt.startsWith("saga")) {
      this.sagaDomain.on(evt, listener);
    }

    if (evt.startsWith("view")) {
      this.viewDomain.on(evt, listener);
    }
  }

  public async query<R>(query: Q): Promise<R> {
    return this.queryDomain.query(query);
  }

  public async setup(): Promise<void> {
    this._status = HermesStatus.Initialising;

    if (this.options.messageBus.rabbit) {
      await this.options.messageBus.rabbit.setup();
    }

    if (this.options.checksumStore.mongo) {
      await this.options.checksumStore.mongo.setup();
    }
    if (this.options.checksumStore.postgres) {
      await this.options.checksumStore.postgres.setup();
    }

    if (this.options.eventStore.mongo) {
      await this.options.eventStore.mongo.setup();
    }
    if (this.options.eventStore.postgres) {
      await this.options.eventStore.postgres.setup();
    }

    if (this.options.sagaStore.mongo) {
      await this.options.sagaStore.mongo.setup();
    }
    if (this.options.sagaStore.postgres) {
      await this.options.sagaStore.postgres.setup();
    }

    if (this.options.viewStore.mongo) {
      await this.options.viewStore.mongo.setup();
    }
    if (this.options.viewStore.postgres) {
      await this.options.viewStore.postgres.setup();
    }
    if (this.options.viewStore.redis) {
      await this.options.viewStore.redis.setup();
    }

    if (!this.options.dangerouslyRegisterHandlersManually) {
      if (!Scanner.hasFiles(this.options.directories.aggregates)) {
        throw new Error(
          `No files found at directory [ ${this.options.directories.aggregates} ]`,
        );
      }

      await this.scanner.scanAggregates();

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

      await this.scanner.scanQueries();

      for (const handler of this.scanner.queryHandlers) {
        this.queryDomain.registerQueryHandler(handler);
      }

      await this.scanner.scanSagas();

      for (const handler of this.scanner.sagaEventHandlers) {
        await this.sagaDomain.registerEventHandler(handler);
      }

      await this.scanner.scanViews();

      for (const handler of this.scanner.viewEventHandlers) {
        await this.viewDomain.registerEventHandler(handler);
        this.registerViewAdapter({ ...handler.view, ...handler.adapter });
      }
    }

    this._status = HermesStatus.Ready;
  }

  // private admin

  private async inspectAggregate<S extends Dict = Dict>(
    aggregate: HermesInspectOptions,
  ): Promise<IAggregate<S>> {
    return this.aggregateDomain.inspect<S>({
      id: aggregate.id,
      name: aggregate.name,
      context: this.scanner.context(aggregate.context),
    });
  }

  private async inspectSaga<S extends Dict = Dict>(
    saga: HermesInspectOptions,
  ): Promise<ISaga<S>> {
    return this.sagaDomain.inspect<S>({
      id: saga.id,
      name: saga.name,
      context: this.scanner.context(saga.context),
    });
  }

  private async inspectView<S extends Dict = Dict>(
    view: HermesInspectOptions,
  ): Promise<IView<S>> {
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

    return this.viewDomain.inspect<S>(viewIdentifier, adapter);
  }

  // private

  private registerViewAdapter(
    adapter: HandlerIdentifier & ViewEventHandlerAdapter,
  ): void {
    this.adapters.push(adapter);
  }
}
