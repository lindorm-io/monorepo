import { Aggregate, Saga } from "../entity";
import { AggregateDomain, ReplayDomain, SagaDomain, ViewDomain } from "../domain";
import { Command } from "../message";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { LindormError } from "@lindorm-io/errors";
import { ReplayEventName } from "../enum";
import { flatten, isArray, merge, snakeCase, uniq } from "lodash";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../handler";
import {
  EventStore,
  MessageBus,
  MongoViewRepository,
  SagaStore,
  PostgresViewRepository,
  ViewEntity,
  ViewStore,
} from "../infrastructure";
import {
  JOI_AGGREGATE_COMMAND_HANDLER_FILE,
  JOI_AGGREGATE_EVENT_HANDLER_FILE,
  JOI_MESSAGE,
  JOI_SAGA_EVENT_HANDLER_FILE,
  JOI_VIEW_EVENT_HANDLER_FILE,
} from "../schema";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  AggregateIdentifier,
  AppAdmin,
  AppInspectOptions,
  AppOptions,
  AppPublishOptions,
  AppPublishResult,
  AppRepositories,
  AppSetup,
  ClassConstructor,
  Data,
  EventEmitterListener,
  HandlerIdentifier,
  IAggregateCommandHandler,
  IAggregateDomain,
  IAggregateEventHandler,
  IDomainEventStore,
  IDomainSagaStore,
  IDomainViewStore,
  IEventSource,
  IReplayDomain,
  ISagaDomain,
  ISagaEventHandler,
  IViewDomain,
  IViewEventHandler,
  MongoIndex,
  PrivateAppOptions,
  SagaEventHandler,
  ScanFileData,
  State,
  ViewEventHandler,
} from "../types";
import {
  assertSchema,
  defaultAggregateCommandHandlerSchema,
  defaultSagaIdFunction,
  defaultViewIdFunction,
  StructureScanner,
} from "../util";
import { randomUUID } from "crypto";

export class EventSource<TCommand extends ClassConstructor = ClassConstructor>
  implements IEventSource<TCommand>
{
  private readonly amqp: IAmqpConnection;
  private readonly messageBus: IMessageBus;
  private readonly mongo: IMongoConnection;
  private readonly postgres: IPostgresConnection;

  private readonly logger: ILogger;
  private readonly options: PrivateAppOptions;
  private readonly require: NodeJS.Require;

  private readonly aggregateDomain: IAggregateDomain;
  private readonly sagaDomain: ISagaDomain;
  private readonly replayDomain: IReplayDomain;
  private readonly viewDomain: IViewDomain;

  private readonly eventStore: IDomainEventStore;
  private readonly sagaStore: IDomainSagaStore;
  private readonly viewStore: IDomainViewStore;

  private readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  private readonly aggregateEventHandlers: Array<IAggregateEventHandler>;
  private readonly sagaEventHandlers: Array<ISagaEventHandler>;
  private readonly viewEventHandlers: Array<IViewEventHandler>;

  private readonly commandAggregates: Record<string, Array<string>>;
  private readonly eventAggregates: Record<string, Array<string>>;

  private readonly viewEntities: Record<string, typeof ViewEntity>;
  private readonly viewIndices: Record<
    string,
    { collection?: string; indices?: Array<MongoIndex>; view: HandlerIdentifier }
  >;

  private initialised: boolean;
  private initialising: boolean;
  private replaying: boolean;

  private promise: () => Promise<void>;

  public constructor(options: AppOptions, logger: ILogger) {
    const { connections = {}, custom = {}, ...appOptions } = options;

    this.logger = logger.createChildLogger(["EventSource"]);
    this.require = custom.require || require;

    this.initialising = false;
    this.initialised = false;

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

    this.amqp = connections.amqp;
    this.mongo = connections.mongo;
    this.postgres = connections.postgres;

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

    this.messageBus = new MessageBus(
      {
        amqp: this.amqp,
        custom: custom.messageBus,
        type: this.options.adapters.messageBus,
      },
      this.logger,
    );

    this.aggregateDomain = new AggregateDomain(
      {
        messageBus: this.messageBus,
        store: this.eventStore,
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

    this.replayDomain = new ReplayDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      eventStore: this.eventStore,
      context: this.options.context,
    });

    this.viewDomain = new ViewDomain(
      {
        messageBus: this.messageBus,
        store: this.viewStore,
      },
      this.logger,
    );

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

    this.commandAggregates = {};
    this.eventAggregates = {};

    this.viewEntities = {};
    this.viewIndices = {};

    this.promise = this.handleInitialise;
  }

  // public properties

  public get isInitialised(): boolean {
    return this.initialised;
  }
  public set isInitialised(_: boolean) {
    /* ignored */
  }

  public get isReplaying(): boolean {
    return this.replaying;
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
      mongo: <S>(name: string, context?: string) =>
        new MongoViewRepository<S>(
          {
            connection: this.mongo,
            view: { name, context: this.context(context) },
          },
          this.logger,
        ),
      postgres: <S>(name: string, context?: string) =>
        new PostgresViewRepository<S>(
          {
            connection: this.postgres,
            ViewEntity: this.viewEntities[this.viewEntityName(name, context)],
            view: { name, context: this.context(context) },
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
      registerAggregateCommandHandlers: this.registerAggregateCommandHandlers.bind(this),
      registerAggregateEventHandlers: this.registerAggregateEventHandlers.bind(this),
      registerSagaEventHandlers: this.registerSagaEventHandlers.bind(this),
      registerViewEventHandlers: this.registerViewEventHandlers.bind(this),
      registerCommandAggregate: this.registerCommandAggregate.bind(this),
      registerEventAggregate: this.registerEventAggregate.bind(this),
    };
  }
  public set setup(_: AppSetup) {
    /* ignored */
  }

  // public app

  public async publish(
    command: TCommand,
    aggregate: Partial<AggregateIdentifier> = {},
    options: AppPublishOptions = {},
  ): Promise<AppPublishResult> {
    await this.promise();

    const name = snakeCase(command.constructor.name);
    const { ...data } = command;

    const commandAggregates = this.commandAggregates[name];

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
      id: aggregate.id || randomUUID(),
      name: aggregate.name || aggregateName,
      context: this.context(aggregate.context),
    };

    const generated = new Command({
      aggregate: resolvedAggregate,
      name,
      data,
      correlationId: options.correlationId,
      delay: options.delay,
      origin: options.origin || "event_source",
      originator: options.originator,
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
      result: this.replaying ? "QUEUED" : "OK",
      aggregate: resolvedAggregate,
    };
  }

  public on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void {
    if (eventName.startsWith("replay")) {
      this.viewDomain.on(eventName, listener);
    }

    if (eventName.startsWith("view")) {
      this.viewDomain.on(eventName, listener);
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

    return this.aggregateDomain.inspect<TState>({
      id: aggregate.id,
      name: aggregate.name,
      context: this.context(aggregate.context),
    });
  }

  private async inspectSaga<TState extends State = State>(
    saga: AppInspectOptions,
  ): Promise<Saga<TState>> {
    await this.promise();

    return this.sagaDomain.inspect<TState>({
      id: saga.id,
      name: saga.name,
      context: this.context(saga.context),
    });
  }

  // private admin register methods

  private async registerAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandlerImplementation>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerCommandHandler(handler);
    }
  }

  private async registerAggregateEventHandlers(
    handlers: Array<AggregateEventHandlerImplementation>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerEventHandler(handler);
    }
  }

  private async registerSagaEventHandlers(
    handlers: Array<SagaEventHandlerImplementation>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.sagaDomain.registerEventHandler(handler);
    }
  }

  private async registerViewEventHandlers(
    handlers: Array<ViewEventHandlerImplementation>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.viewDomain.registerEventHandler(handler);
    }

    this.registerViewEntities(handlers);
    this.registerViewIndices(handlers);
  }

  private registerViewEntities(handlers: Array<ViewEventHandlerImplementation>): void {
    this.assertRegister();

    for (const handler of handlers) {
      if (!handler.adapters.postgres) continue;

      if (!handler.adapters.postgres?.ViewEntity) {
        throw new LindormError("Invalid ViewEventHandler", {
          description: "View Event Handler registered without ViewEntity",
          data: {
            adapters: handler.adapters,
            view: handler.view,
          },
        });
      }

      this.viewEntities[this.viewEntityName(handler.view.name, handler.view.context)] =
        handler.adapters.postgres.ViewEntity;
    }
  }

  private registerViewIndices(handlers: Array<ViewEventHandlerImplementation>): void {
    this.assertRegister();

    for (const handler of handlers) {
      if (!handler.adapters.mongo) continue;

      this.viewIndices[this.viewEntityName(handler.view.name, handler.view.context)] = {
        view: handler.view,
        collection: handler.adapters.mongo.collection,
        indices: handler.adapters.mongo.indices,
      };
    }
  }

  private registerCommandAggregate(name: string, aggregate: string): void {
    const current = this.commandAggregates[name] || [];
    this.commandAggregates[name] = uniq(flatten([current, aggregate]));
  }

  private registerEventAggregate(name: string, aggregate: string): void {
    const current = this.eventAggregates[name] || [];
    this.eventAggregates[name] = uniq(flatten([current, aggregate]));
  }

  // private initialisation handler

  private async handleInitialise(): Promise<void> {
    this.initialising = true;

    if (this.options.dangerouslyRegisterHandlersManually) {
      await this.setupReplayDomain();

      this.initialised = true;
      this.initialising = false;

      this.promise = (): Promise<void> => Promise.resolve();
    }

    if (StructureScanner.hasFiles(this.options.directory)) {
      await this.scanFiles();

      await this.registerAggregateCommandHandlers(this.aggregateCommandHandlers);
      await this.registerAggregateEventHandlers(this.aggregateEventHandlers);
      await this.registerSagaEventHandlers(this.sagaEventHandlers);
      await this.registerViewEventHandlers(this.viewEventHandlers);
    }

    await this.eventStore.initialise();
    await this.sagaStore.initialise();
    await this.viewStore.initialise(Object.values(this.viewIndices).map((item) => item));

    await this.setupReplayDomain();

    this.initialised = true;
    this.initialising = false;

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private handler scanner

  private async scanFiles(): Promise<void> {
    const scanner = new StructureScanner(this.options.directory, this.options.scanner.extensions);

    const files = scanner.scan();

    for (const file of files) {
      this.logger.debug("Scanning aggregate", { file });

      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting file structure: [ ./ aggregates / {commands|events} / {commandName|eventName} . {command|command-handler|event|event-handler|saga-handler|view-handler} . {js|ts} ]",
        );
      }

      if (!this.isValid("aggregate", file.name)) continue;

      const [directory] = file.parents;

      switch (`${directory}.${file.type}`) {
        case "commands.command":
          this.loadCommandAggregate(file);
          break;

        case "commands.handler":
          this.loadCommandHandlers(file);
          break;

        case "events.event":
          this.loadEventAggregate(file);
          break;

        case "events.handler":
          this.loadEventHandlers(file);
          break;

        case "events.saga":
          this.loadSagaHandlers(file);
          break;

        case "events.view":
          this.loadViewHandlers(file);
          break;

        default:
          break;
      }
    }
  }

  // private handler loaders

  private loadCommandHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command handler location");
    }

    const handlers = this.getFileHandlers<AggregateCommandHandler<unknown, unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate command handler", { handler: file.path });

      assertSchema(JOI_AGGREGATE_COMMAND_HANDLER_FILE.required().validate(handler));

      this.aggregateCommandHandlers.push(
        new AggregateCommandHandlerImplementation({
          commandName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregate),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          schema: handler.schema ? handler.schema : defaultAggregateCommandHandlerSchema,
          version: handler.version,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadEventHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<AggregateEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate event handler", { handler: file.path });

      assertSchema(JOI_AGGREGATE_EVENT_HANDLER_FILE.required().validate(handler));

      this.aggregateEventHandlers.push(
        new AggregateEventHandlerImplementation({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregate),
            context: snakeCase(this.options.context),
          },
          version: handler.version,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadSagaHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<SagaEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found saga event handler", { handler: file.path });

      assertSchema(JOI_SAGA_EVENT_HANDLER_FILE.required().validate(handler));

      this.sagaEventHandlers.push(
        new SagaEventHandlerImplementation({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          saga: {
            name: snakeCase(handler.name),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          version: handler.version,
          getSagaId: handler.getSagaId ? handler.getSagaId : defaultSagaIdFunction,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadViewHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<ViewEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found view event handler", { handler: file.path });

      assertSchema(JOI_VIEW_EVENT_HANDLER_FILE.required().validate(handler));

      this.viewEventHandlers.push(
        new ViewEventHandlerImplementation({
          eventName: snakeCase(file.name),
          adapters: handler.adapters,
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          view: {
            name: snakeCase(handler.name),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          version: handler.version,
          getViewId: handler.getViewId ? handler.getViewId : defaultViewIdFunction,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadCommandAggregate(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command location");
    }

    const name = snakeCase(file.name);

    this.registerCommandAggregate(name, aggregate);
  }

  private loadEventAggregate(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event location");
    }

    const name = snakeCase(file.name);

    this.registerEventAggregate(name, aggregate);
  }

  // private

  private async setupReplayDomain(): Promise<void> {
    this.replayDomain.on(ReplayEventName.START, this.onReplayStart.bind(this));
    this.replayDomain.on(ReplayEventName.STOP, this.onReplayStop.bind(this));

    await this.replayDomain.subscribe();
  }

  private assertRegister(): boolean {
    if (this.initialising) return;
    if (this.replaying) return;
    if (this.options.dangerouslyRegisterHandlersManually) return;

    throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
  }

  private getFileHandlers<Handler>(path: string): Array<Handler> {
    const required = this.require(path);
    const handlers = required.default || required.main;

    if (!handlers) {
      throw new Error(`Expected methods [ default | main ] from [ ${path} ]`);
    }

    if (isArray(handlers)) {
      return handlers as Array<Handler>;
    }

    return [handlers as Handler];
  }

  private isValid(type: string, name: string): boolean {
    for (const regExp of this.options.scanner.include) {
      if (!regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is not included in domain`);
        return false;
      }
    }

    for (const regExp of this.options.scanner.exclude) {
      if (regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is excluded in domain`);
        return false;
      }
    }

    return true;
  }

  private context(context?: string): string {
    return context || this.options.context;
  }

  private viewEntityName(name: string, context?: string): string {
    return `view_${this.context(context)}_${name}`;
  }

  // private event listeners

  private onReplayStart(): void {
    this.replaying = true;

    this.aggregateDomain
      .removeAllCommandHandlers()
      .then(() => {
        this.logger.verbose("Removed handlers");
      })
      .catch((err) => {
        this.logger.error("Failed to remove handlers", err);
      });
  }

  private onReplayStop(): void {
    this.registerAggregateCommandHandlers(this.aggregateCommandHandlers)
      .then(() => {
        this.logger.verbose("Registered handlers");
        this.replaying = false;
      })
      .catch((err) => {
        this.logger.error("Failed to register handlers", err);
      });
  }
}
