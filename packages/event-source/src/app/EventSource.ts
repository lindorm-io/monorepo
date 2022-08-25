import { Aggregate, Saga } from "../entity";
import { Command } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import { JOI_MESSAGE } from "../schema";
import { LindormError } from "@lindorm-io/errors";
import { ReplayEventName } from "../enum";
import { StructureScanner } from "../util";
import { merge, snakeCase } from "lodash";
import { randomUUID } from "crypto";
import {
  EventSourceConnections,
  EventSourceDomains,
  EventSourceHandlers,
  EventSourceScanner,
  EventSourceStores,
} from "./fragments";
import {
  MemoryViewRepository,
  MessageBus,
  MongoViewRepository,
  PostgresViewRepository,
} from "../infrastructure";
import {
  AppAdmin,
  AppInspectOptions,
  AppOptions,
  AppPublishOptions,
  AppPublishResult,
  AppRepositories,
  AppSetup,
  DtoClass,
  Data,
  EventEmitterListener,
  IEventSource,
  PrivateAppOptions,
  State,
} from "../types";

export class EventSource<TCommand extends DtoClass = DtoClass> implements IEventSource<TCommand> {
  private readonly connections: EventSourceConnections;
  private readonly domains: EventSourceDomains;
  private readonly handlers: EventSourceHandlers;
  private readonly logger: ILogger;
  private readonly messageBus: IMessageBus;
  private readonly options: PrivateAppOptions;
  private readonly scanner: EventSourceScanner;
  private readonly stores: EventSourceStores;

  private status: "initialising" | "initialised" | "replaying" | "created";
  private promise: () => Promise<void>;

  public constructor(options: AppOptions, logger: ILogger) {
    const { connections = {}, custom = {}, ...appOptions } = options;

    this.logger = logger.createChildLogger(["EventSource"]);

    this.options = merge<Partial<PrivateAppOptions>, PrivateAppOptions>(
      {
        adapters: {
          eventStore: "memory",
          sagaStore: "memory",
          viewStore: "memory",
          messageBus: "memory",
        },
        context: "default",
        directory: null,
        scanner: {
          extensions: [".js", ".ts"],
          include: [/.*/],
          exclude: [],
        },
        dangerouslyRegisterHandlersManually: false,
      },
      appOptions,
    );

    this.status = "created";

    this.connections = new EventSourceConnections(connections);
    this.stores = new EventSourceStores(this.options, custom, this.connections, this.logger);

    this.messageBus = new MessageBus(
      {
        amqp: this.connections.amqp,
        custom: custom.messageBus,
        type: this.options.adapters.messageBus,
      },
      this.logger,
    );

    this.domains = new EventSourceDomains(this.options, this.stores, this.messageBus, this.logger);
    this.handlers = new EventSourceHandlers(this.options, this.domains, this.stores);
    this.scanner = new EventSourceScanner(this.options, custom, this.handlers, this.logger);

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

  public get admin(): AppAdmin {
    return {
      inspect: {
        aggregate: this.inspectAggregate.bind(this),
        saga: this.inspectSaga.bind(this),
      },
      replay: async () => undefined, // this.replay.bind(this),
    };
  }
  public set admin(_: AppAdmin) {
    /* ignored */
  }

  public get repositories(): AppRepositories {
    return {
      memory: <S>(name: string, context?: string) =>
        new MemoryViewRepository<S>({ name, context: this.handlers.context(context) }),
      mongo: <S>(name: string, context?: string) =>
        new MongoViewRepository<S>(
          {
            connection: this.connections.mongo,
            view: { name, context: this.handlers.context(context) },
          },
          this.logger,
        ),
      postgres: <S>(name: string, context?: string) =>
        new PostgresViewRepository<S>(
          {
            connection: this.connections.postgres,
            ViewEntity: this.stores.viewEntities[this.handlers.viewEntityName(name, context)],
            view: { name, context: this.handlers.context(context) },
          },
          this.logger,
        ),
    };
  }
  public set repositories(_: AppRepositories) {
    /* ignored */
  }

  public get setup(): AppSetup {
    return {
      registerAggregateCommandHandlers: this.handlers.registerAggregateCommandHandlers.bind(
        this.handlers,
      ),
      registerAggregateEventHandlers: this.handlers.registerAggregateEventHandlers.bind(
        this.handlers,
      ),
      registerSagaEventHandlers: this.handlers.registerSagaEventHandlers.bind(this.handlers),
      registerViewEventHandlers: this.handlers.registerViewEventHandlers.bind(this.handlers),
      registerCommandAggregate: this.handlers.registerCommandAggregate.bind(this.handlers),
      registerEventAggregate: this.handlers.registerEventAggregate.bind(this.handlers),
    };
  }
  public set setup(_: AppSetup) {
    /* ignored */
  }

  // public app

  public async publish(
    command: TCommand,
    options: AppPublishOptions = {},
  ): Promise<AppPublishResult> {
    await this.promise();

    const name = snakeCase(command.constructor.name);
    const { ...data } = command;

    const commandAggregates = this.handlers.commandAggregates[name];

    if (!commandAggregates.length) {
      throw new LindormError("Invalid Command", {
        data: { commandAggregates },
        description: "Aggregate not registered to command",
      });
    }

    if (commandAggregates.length > 1) {
      throw new LindormError("Invalid Command", {
        data: { commandAggregates },
        description:
          "Multiple aggregates registered to command. You need to specify which aggregate in options",
      });
    }

    const [aggregateName] = commandAggregates;

    const resolvedAggregate = {
      id: options.aggregate?.id || randomUUID(),
      name: options.aggregate?.name || aggregateName,
      context: this.handlers.context(options.aggregate?.context),
    };

    const generated = new Command({
      aggregate: resolvedAggregate,
      name,
      data,
      correlationId: options.correlationId,
      delay: options.delay,
      origin: options.origin || "event_source",
      originId: options.originId,
      version: options.version,
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

  public on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void {
    if (eventName.startsWith("replay")) {
      this.domains.view.on(eventName, listener);
    }

    if (eventName.startsWith("view")) {
      this.domains.view.on(eventName, listener);
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
    aggregate: AppInspectOptions,
  ): Promise<Aggregate<TState>> {
    await this.promise();

    return this.domains.aggregate.inspect<TState>({
      id: aggregate.id,
      name: aggregate.name,
      context: this.handlers.context(aggregate.context),
    });
  }

  private async inspectSaga<TState extends State = State>(
    saga: AppInspectOptions,
  ): Promise<Saga<TState>> {
    await this.promise();

    return this.domains.saga.inspect<TState>({
      id: saga.id,
      name: saga.name,
      context: this.handlers.context(saga.context),
    });
  }

  // private initialisation handler

  private async handleInitialisation(): Promise<void> {
    this.status = "initialising";

    if (!this.options.dangerouslyRegisterHandlersManually) {
      if (!StructureScanner.hasFiles(this.options.directory)) {
        throw new Error(`No files found at directory [ ${this.options.directory} ]`);
      }

      await this.scanner.scanFiles();

      await this.handlers.registerAggregateCommandHandlers(this.handlers.aggregateCommandHandlers);
      await this.handlers.registerAggregateEventHandlers(this.handlers.aggregateEventHandlers);
      await this.handlers.registerSagaEventHandlers(this.handlers.sagaEventHandlers);
      await this.handlers.registerViewEventHandlers(this.handlers.viewEventHandlers);
    }

    await this.setupReplayDomain();

    this.status = "initialised";
    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private async setupReplayDomain(): Promise<void> {
    this.domains.replay.on(ReplayEventName.START, this.onReplayStart.bind(this));
    this.domains.replay.on(ReplayEventName.STOP, this.onReplayStop.bind(this));

    await this.domains.replay.subscribe();
  }

  // private event listeners

  private onReplayStart(): void {
    this.status = "replaying";

    this.domains.aggregate
      .removeAllCommandHandlers()
      .then(() => {
        this.logger.verbose("Removed handlers");
      })
      .catch((err) => {
        this.logger.error("Failed to remove handlers", err);
      });
  }

  private onReplayStop(): void {
    this.handlers
      .registerAggregateCommandHandlers(this.handlers.aggregateCommandHandlers)
      .then(() => {
        this.logger.verbose("Registered handlers");
        this.status = "initialised";
      })
      .catch((err) => {
        this.logger.error("Failed to register handlers", err);
      });
  }
}
