import { Aggregate, Saga } from "../entity";
import { AggregateDomain, ReplayDomain, SagaDomain, ViewDomain } from "../domain";
import { Command } from "../message";
import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { IRedisConnection } from "@lindorm-io/redis";
import { LindormError } from "@lindorm-io/errors";
import { EventStoreType, MessageBusType, ReplayEventName, SagaStoreType } from "../enum";
import {
  defaultAggregateCommandHandlerSchema,
  defaultSagaIdFunction,
  defaultViewIdFunction,
  StructureScanner,
} from "../util";
import { isArray, merge, snakeCase } from "lodash";
import { join } from "path";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";
import {
  EventStore,
  MessageBus,
  MongoViewRepository,
  PostgresViewRepository,
  RedisViewRepository,
  SagaStore,
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
  AggregateCommandHandlerFile,
  AggregateEventHandlerFile,
  AppAdmin,
  AppInspectOptions,
  AppOptions,
  AppPublishOptions,
  AppPublishResult,
  AppRepositories,
  AppSetup,
  AppStructure,
  Data,
  EventEmitterListener,
  IAggregateCommandHandler,
  IAggregateDomain,
  IAggregateEventHandler,
  IEventSource,
  IReplayDomain,
  ISagaDomain,
  ISagaEventHandler,
  IViewDomain,
  IViewEventHandler,
  PrivateAppOptions,
  SagaEventHandlerFile,
  State,
  ViewEventHandlerFile,
} from "../types";

export class EventSource implements IEventSource {
  private readonly amqp: IAmqpConnection;
  private readonly messageBus: IMessageBus;
  private readonly mongo: IMongoConnection;
  private readonly postgres: IPostgresConnection;
  private readonly redis: IRedisConnection;

  private readonly logger: ILogger;
  private readonly options: PrivateAppOptions;

  private readonly aggregateDomain: IAggregateDomain;
  private readonly sagaDomain: ISagaDomain;
  private readonly replayDomain: IReplayDomain;
  private readonly viewDomain: IViewDomain;

  private readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  private readonly aggregateEventHandlers: Array<IAggregateEventHandler>;
  private readonly sagaEventHandlers: Array<ISagaEventHandler>;
  private readonly viewEventHandlers: Array<IViewEventHandler>;

  private readonly entities: Record<string, typeof ViewEntity>;
  private initialised: boolean;
  private initialising: boolean;
  private replaying: boolean;

  private promise: () => Promise<void>;

  public constructor(options: AppOptions, logger: ILogger) {
    const { amqp, mongo, postgres, redis, ...appOptions } = options;

    this.logger = logger.createChildLogger(["App"]);

    this.entities = {};
    this.initialising = false;
    this.initialised = false;

    this.options = merge<Partial<PrivateAppOptions>, PrivateAppOptions>(
      {
        domain: {
          directory: null,
          context: "default",
        },
        aggregates: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "aggregates")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
          persistence: EventStoreType.MONGO,
        },
        sagas: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "sagas")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
          persistence: SagaStoreType.MONGO,
        },
        views: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "views")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        messageBus: {
          queue: MessageBusType.AMQP,
        },
        require: require,
      },
      appOptions,
    );

    this.amqp = amqp;
    this.mongo = mongo;
    this.postgres = postgres;
    this.redis = redis;

    const eventStore = new EventStore(
      {
        custom: options.custom?.eventStore,
        mongo: this.mongo,
        postgres: this.postgres,
        type: this.options.aggregates.persistence,
      },
      this.logger,
    );

    const sagaStore = new SagaStore(
      {
        custom: options.custom?.sagaStore,
        mongo: this.mongo,
        postgres: this.postgres,
        type: this.options.sagas.persistence,
      },
      this.logger,
    );

    const viewStore = new ViewStore(
      {
        custom: options.custom?.viewStore,
        mongo: this.mongo,
        postgres: this.postgres,
        redis: this.redis,
      },
      this.logger,
    );

    this.messageBus = new MessageBus(
      {
        amqp: this.amqp,
        type: this.options.messageBus?.queue,
      },
      this.logger,
    );

    this.aggregateDomain = new AggregateDomain(
      {
        messageBus: this.messageBus,
        store: eventStore,
      },
      this.logger,
    );

    this.sagaDomain = new SagaDomain(
      {
        messageBus: this.messageBus,
        store: sagaStore,
      },
      this.logger,
    );

    this.replayDomain = new ReplayDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      eventStore: eventStore,
      context: this.options.domain.context,
    });

    this.viewDomain = new ViewDomain(
      {
        messageBus: this.messageBus,
        store: viewStore,
      },
      this.logger,
    );

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

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
      mongo: <S>(name: string, collection?: string) =>
        new MongoViewRepository<S>(
          {
            collection,
            connection: this.mongo,
            view: { name, context: this.options.domain.context },
          },
          this.logger,
        ),
      postgres: <S>(name: string, entity?: typeof ViewEntity) =>
        new PostgresViewRepository<S>(
          {
            connection: this.postgres,
            viewEntity: entity || this.entities[name],
          },
          this.logger,
        ),
      redis: <S>(name: string) =>
        new RedisViewRepository<S>(
          {
            connection: this.redis,
            view: { name, context: this.options.domain.context },
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
    };
  }
  public set setup(_: AppSetup) {
    /* ignored */
  }

  // public app

  public async publish(options: AppPublishOptions): Promise<AppPublishResult> {
    await this.promise();

    const command = new Command({
      aggregate: {
        id: options.aggregate.id,
        name: options.aggregate.name,
        context: options.aggregate.context || this.options.domain.context,
      },
      name: options.name,
      data: options.data,
      correlationId: options.correlationId,
      delay: options.delay,
      mandatory: options.mandatory,
      origin: options.origin || "event_source",
      originator: options.originator,
    });

    await JOI_MESSAGE.validateAsync(command);

    if (!(command instanceof Command)) {
      throw new LindormError("Invalid operation", {
        data: {
          expect: "Command",
          actual: typeof command,
        },
      });
    }

    await this.messageBus.publish(command);

    if (this.replaying) return "QUEUED";
    return "OK";
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

  private async inspectAggregate<S extends State = State>(
    aggregate: AppInspectOptions,
  ): Promise<Aggregate<S>> {
    await this.promise();

    return this.aggregateDomain.inspect<S>({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context || this.options.domain.context,
    });
  }

  private async inspectSaga<S extends State = State>(saga: AppInspectOptions): Promise<Saga<S>> {
    await this.promise();

    return this.sagaDomain.inspect<S>({
      id: saga.id,
      name: saga.name,
      context: saga.context || this.options.domain.context,
    });
  }

  // private admin register methods

  private async registerAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandler>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerCommandHandler(handler);
    }
  }

  private async registerAggregateEventHandlers(
    handlers: Array<AggregateEventHandler>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerEventHandler(handler);
    }
  }

  private async registerSagaEventHandlers(handlers: Array<SagaEventHandler>): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.sagaDomain.registerEventHandler(handler);
    }
  }

  private async registerViewEventHandlers(handlers: Array<ViewEventHandler>): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.viewDomain.registerEventHandler(handler);
    }
    this.registerViewEntities(handlers);
  }

  private registerViewEntities(handlers: Array<ViewEventHandler>): void {
    this.assertRegister();

    for (const handler of handlers) {
      if (handler.persistence.type !== "postgres") continue;

      if (
        !handler.persistence.postgres?.viewEntity ||
        !handler.persistence.postgres?.causationEntity
      ) {
        throw new LindormError("Invalid ViewEventHandler", {
          description: "View Event Handler registered without entities",
          data: {
            persistence: handler.persistence,
            view: handler.view,
          },
        });
      }

      this.entities[handler.view.name] = handler.persistence.postgres.viewEntity;
    }
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

    if (StructureScanner.hasFiles(this.options.aggregates.directory)) {
      await this.scanAggregates();
      await this.registerAggregateCommandHandlers(this.aggregateCommandHandlers);
      await this.registerAggregateEventHandlers(this.aggregateEventHandlers);
    }

    if (StructureScanner.hasFiles(this.options.sagas.directory)) {
      await this.scanSagas();
      await this.registerSagaEventHandlers(this.sagaEventHandlers);
    }

    if (StructureScanner.hasFiles(this.options.views.directory)) {
      await this.scanViews();
      await this.registerViewEventHandlers(this.viewEventHandlers);
    }

    await this.setupReplayDomain();

    this.initialised = true;
    this.initialising = false;

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private scan handlers

  private async scanAggregates(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.aggregates.directory,
      this.options.aggregates.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      this.logger.debug("Scanning aggregate", { file });

      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./aggregates/{aggregateName}/{commands|events}/{commandName|eventName} ]",
        );
      }

      const type = file.parents[0];
      const aggregateName = file.parents[1];

      if (!this.isValid("aggregate", aggregateName, this.options.aggregates)) break;

      let handler: AggregateCommandHandlerFile | AggregateEventHandlerFile;

      switch (type) {
        case "commands":
          handler = this.getFileHandler<AggregateCommandHandlerFile>(file.path);

          this.logger.debug("Found aggregate command handler", { handler });

          await JOI_AGGREGATE_COMMAND_HANDLER_FILE.required().validateAsync(handler);

          this.aggregateCommandHandlers.push(
            new AggregateCommandHandler({
              commandName: snakeCase(file.name),
              aggregate: {
                name: snakeCase(aggregateName),
                context: snakeCase(this.options.domain.context),
              },
              conditions: handler.conditions,
              schema: handler.schema ? handler.schema : defaultAggregateCommandHandlerSchema,
              handler: handler.handler,
            }),
          );
          break;

        case "events":
          handler = this.getFileHandler<AggregateEventHandlerFile>(file.path);

          this.logger.debug("Found aggregate event handler", { handler });

          await JOI_AGGREGATE_EVENT_HANDLER_FILE.required().validateAsync(handler);

          this.aggregateEventHandlers.push(
            new AggregateEventHandler({
              eventName: snakeCase(file.name),
              aggregate: {
                name: snakeCase(aggregateName),
                context: snakeCase(this.options.domain.context),
              },
              handler: handler.handler,
            }),
          );
          break;

        default:
          throw new Error(
            "Expecting folder names: [ ./aggregates/{aggregateName}/{commands|events}/{commandName|eventName} ]",
          );
      }
    }
  }

  private async scanSagas(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.sagas.directory,
      this.options.sagas.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      this.logger.debug("Scanning saga", { file });

      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./sagas/{sagaName}/{aggregateName}/{eventName} ]",
        );
      }

      const sagaName = file.parents[1];
      const aggregateName = file.parents[0];

      if (!this.isValid("saga", sagaName, this.options.sagas)) break;

      const handler = this.getFileHandler<SagaEventHandlerFile>(file.path);

      this.logger.debug("Found saga event handler", { handler });

      await JOI_SAGA_EVENT_HANDLER_FILE.required().validateAsync(handler);

      this.sagaEventHandlers.push(
        new SagaEventHandler({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregateName),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(handler.aggregate?.context || this.options.domain.context),
          },
          saga: {
            name: snakeCase(sagaName),
            context: snakeCase(this.options.domain.context),
          },
          conditions: handler.conditions,
          options: handler.options,
          getSagaId: handler.getSagaId ? handler.getSagaId : defaultSagaIdFunction,
          handler: handler.handler,
        }),
      );
    }
  }

  private async scanViews(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.views.directory,
      this.options.views.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      this.logger.debug("Scanning view", { file });

      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./views/{viewName}/{aggregateName}/{eventName} ]",
        );
      }

      const viewName = file.parents[1];
      const aggregateName = file.parents[0];

      if (!this.isValid("view", viewName, this.options.views)) break;

      const handler = this.getFileHandler<ViewEventHandlerFile>(file.path);

      this.logger.debug("Found view event handler", { handler });

      await JOI_VIEW_EVENT_HANDLER_FILE.required().validateAsync(handler);

      this.viewEventHandlers.push(
        new ViewEventHandler({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregateName),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(handler.aggregate?.context || this.options.domain.context),
          },
          view: {
            name: snakeCase(viewName),
            context: snakeCase(this.options.domain.context),
          },
          conditions: handler.conditions,
          persistence: handler.persistence,
          getViewId: handler.getViewId ? handler.getViewId : defaultViewIdFunction,
          handler: handler.handler,
        }),
      );
    }
  }

  // private handlers

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

  private getFileHandler<Handler>(path: string): Handler {
    const required = this.options.require(path);
    const handler = required.default || required.main || required.handler;

    if (!handler) {
      throw new Error(`Expected methods [ default | main | handler ] from [ ${path} ]`);
    }

    return handler as Handler;
  }

  private isValid(type: string, name: string, structure: AppStructure): boolean {
    for (const regExp of structure.include) {
      if (!regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is not included in domain`);
        return false;
      }
    }

    for (const regExp of structure.exclude) {
      if (regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is excluded in domain`);
        return false;
      }
    }

    return true;
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
