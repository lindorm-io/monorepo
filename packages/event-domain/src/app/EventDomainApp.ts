import Joi from "joi";
import { Aggregate } from "../entity";
import { AggregateDomain, CacheDomain, ReplayDomain, SagaDomain, ViewDomain } from "../domain";
import { AmqpConnection } from "@lindorm-io/amqp";
import { Command } from "../message";
import { Filter, FindOptions } from "mongodb";
import { JOI_MESSAGE } from "../constant";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { ReplayEventName } from "../enum";
import { StructureScanner } from "../util";
import { join } from "path";
import { merge, snakeCase } from "lodash";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  CacheEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";
import {
  CacheRepository,
  CacheStore,
  EventStore,
  MessageBus,
  SagaStore,
  ViewRepository,
  ViewStore,
} from "../infrastructure";
import {
  AggregateCommandHandlerFile,
  AggregateEventHandlerFile,
  AppOptions,
  AppStructure,
  CacheEventHandlerFile,
  CreateCacheRepositoryOptions,
  CreateViewRepositoryOptions,
  EventDomainAppOptions,
  EventEmitterListener,
  HandlerConditions,
  IEventDomainApp,
  InspectAggregateOptions,
  PublishOptions,
  PublishResult,
  ReplayOptions,
  SagaEventHandlerFile,
  SagaStoreSaveOptions,
  State,
  StoreBaseIndex,
  ViewEventHandlerFile,
  ViewStoreAttributes,
  ViewStoreDocumentOptions,
  ViewStoreQueryOptions,
} from "../types";

export class EventDomainApp implements IEventDomainApp {
  private readonly amqp: AmqpConnection;
  private readonly messageBus: MessageBus;
  private readonly mongo: MongoConnection;
  private readonly redis: RedisConnection;

  private readonly logger: Logger;
  private readonly options: AppOptions;

  private readonly aggregateDomain: AggregateDomain;
  private readonly cacheDomain: CacheDomain;
  private readonly sagaDomain: SagaDomain;
  private readonly replayDomain: ReplayDomain;
  private readonly viewDomain: ViewDomain;

  private readonly aggregateCommandHandlers: Array<AggregateCommandHandler>;
  private readonly aggregateEventHandlers: Array<AggregateEventHandler>;
  private readonly cacheEventHandlers: Array<CacheEventHandler>;
  private readonly sagaEventHandlers: Array<SagaEventHandler>;
  private readonly viewEventHandlers: Array<ViewEventHandler>;

  private promise: () => Promise<void>;
  private initialising: boolean;
  private initialised: boolean;
  private replaying: boolean;

  public constructor(options: EventDomainAppOptions) {
    const { amqp, mongo, redis, logger, ...appOptions } = options;

    this.logger = logger.createChildLogger(["EventDomainApp"]);

    this.initialising = false;
    this.initialised = false;

    this.options = merge(
      {
        domain: {
          database: null,
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
        },
        caches: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "caches")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        sagas: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "sagas")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        views: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "views")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        require: require,
      },
      appOptions,
    );

    this.amqp = amqp;
    this.mongo = mongo;
    this.redis = redis;

    const eventStore = new EventStore({
      connection: this.mongo,
      database: this.options.domain.database,
      logger: this.logger,
    });

    const sagaStore = new SagaStore({
      connection: this.mongo,
      database: this.options.domain.database,
      logger: this.logger,
    });

    const viewStore = new ViewStore({
      connection: this.mongo,
      database: this.options.domain.database,
      logger: this.logger,
    });

    this.messageBus = new MessageBus({
      connection: this.amqp,
      logger: this.logger,
    });

    this.aggregateDomain = new AggregateDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: eventStore,
    });

    this.sagaDomain = new SagaDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: sagaStore,
    });

    this.replayDomain = new ReplayDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      eventStore,
      viewStore,
      context: this.options.domain.context,
    });

    this.viewDomain = new ViewDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: viewStore,
    });

    if (this.redis) {
      this.cacheDomain = new CacheDomain({
        messageBus: this.messageBus,
        logger: this.logger,
        store: new CacheStore({
          connection: this.redis,
          logger: this.logger,
        }),
      });
    }

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.cacheEventHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

    this.promise = this.initialise;
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

  // public

  public createCacheRepository<S>(
    name: string,
    options: CreateCacheRepositoryOptions = {},
  ): CacheRepository<S> {
    return new CacheRepository<S>({
      connection: this.redis,
      logger: this.logger,
      cache: {
        name,
        context: options.context || this.options.domain.context,
      },
    });
  }

  public createViewRepository<S>(
    name: string,
    options: CreateViewRepositoryOptions = {},
  ): ViewRepository<S> {
    const view = {
      name,
      context: options.context || this.options.domain.context,
    };

    return new ViewRepository<S>({
      collection: options.collection || ViewStore.getCollectionName(view),
      connection: this.mongo,
      database: options.database || this.options.domain.database,
      indices: options.indices,
      logger: this.logger,
      view,
    });
  }

  public async init(): Promise<void> {
    await this.promise();
  }

  public async inspect<S extends State = State>(
    aggregate: InspectAggregateOptions,
  ): Promise<Aggregate<S>> {
    await this.promise();

    return this.aggregateDomain.inspect<S>({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context || this.options.domain.context,
    });
  }

  public on<S = State>(eventName: string, listener: EventEmitterListener<S>): void {
    if (eventName.startsWith("cache")) {
      this.cacheDomain.on(eventName, listener);
    }

    if (eventName.startsWith("replay")) {
      this.viewDomain.on(eventName, listener);
    }

    if (eventName.startsWith("view")) {
      this.viewDomain.on(eventName, listener);
    }
  }

  public async publish(options: PublishOptions): Promise<PublishResult> {
    await this.promise();

    const command = new Command({
      aggregate: {
        id: options.aggregate.id,
        name: options.aggregate.name,
        context: options.aggregate.context || this.options.domain.context,
      },
      name: options.name,
      data: options.data,
      delay: options.delay,
      mandatory: options.mandatory,
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

  public async query<S extends State = State>(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes<S>>> {
    await this.promise();
    return this.viewDomain.query<S>(queryOptions, filter, findOptions);
  }

  public async replay(options: ReplayOptions): Promise<void> {
    await this.promise();
    return this.replayDomain.replay(options);
  }

  public async views(): Promise<Array<string>> {
    await this.promise();
    return this.viewDomain.listCollections();
  }

  // public handler methods

  public async registerAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandler>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerCommandHandler(handler);
    }
  }

  public async registerAggregateEventHandlers(
    handlers: Array<AggregateEventHandler>,
  ): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.aggregateDomain.registerEventHandler(handler);
    }
  }

  public async registerCacheEventHandlers(handlers: Array<CacheEventHandler>): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.cacheDomain.registerEventHandler(handler);
    }
  }

  public async registerSagaEventHandlers(handlers: Array<SagaEventHandler>): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.sagaDomain.registerEventHandler(handler);
    }
  }

  public async registerViewEventHandlers(handlers: Array<ViewEventHandler>): Promise<void> {
    this.assertRegister();

    for (const handler of handlers) {
      await this.viewDomain.registerEventHandler(handler);
    }
  }

  // private

  private async initialise(): Promise<void> {
    if (this.options.dangerouslyRegisterHandlersManually) {
      this.initialised = true;
      return;
    }

    this.initialising = true;

    if (StructureScanner.hasFiles(this.options.aggregates.directory)) {
      await this.scanAggregates();
      await this.registerAggregateCommandHandlers(this.aggregateCommandHandlers);
      await this.registerAggregateEventHandlers(this.aggregateEventHandlers);
    }

    if (StructureScanner.hasFiles(this.options.caches.directory)) {
      await this.scanCaches();
      await this.registerCacheEventHandlers(this.cacheEventHandlers);
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

  // private scan methods

  private async scanAggregates(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.aggregates.directory,
      this.options.aggregates.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./aggregates/{aggregateName}/{commands|events}/{commandName|eventName} ]",
        );
      }

      const type = file.parents[0];
      const aggregateName = file.parents[1];

      if (!this.isValid("aggregate", aggregateName, this.options.aggregates)) break;

      const handler = this.options.require(file.path).default;

      switch (type) {
        case "commands":
          await Joi.object<AggregateCommandHandlerFile>()
            .keys({
              conditions: Joi.object<HandlerConditions>()
                .keys({
                  created: Joi.boolean().optional(),
                  permanent: Joi.boolean().optional(),
                })
                .optional(),
              schema: Joi.object().required(),
              handler: Joi.function().required(),
            })
            .required()
            .validateAsync(handler);

          this.aggregateCommandHandlers.push(
            new AggregateCommandHandler({
              commandName: snakeCase(file.name),
              aggregate: {
                name: snakeCase(aggregateName),
                context: snakeCase(this.options.domain.context),
              },
              conditions: handler.conditions,
              schema: handler.schema,
              handler: handler.handler,
            }),
          );
          break;

        case "events":
          await Joi.object<AggregateEventHandlerFile>()
            .keys({
              handler: Joi.function().required(),
            })
            .required()
            .validateAsync(handler);

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

  private async scanCaches(): Promise<void> {
    if (!this.redis) {
      throw new Error("RedisConnection has not been added to EventDomainApp options");
    }

    const scanner = new StructureScanner(
      this.options.caches.directory,
      this.options.caches.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./caches/{cacheName}/{aggregateName}/{eventName} ]",
        );
      }

      const cacheName = file.parents[1];
      const aggregateName = file.parents[0];

      if (!this.isValid("cache", cacheName, this.options.caches)) break;

      const handler = this.options.require(file.path).default;

      await Joi.object<CacheEventHandlerFile>()
        .keys({
          conditions: Joi.object<HandlerConditions>()
            .keys({
              created: Joi.boolean().optional(),
              permanent: Joi.boolean().optional(),
            })
            .optional(),
          context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional(),
          getCacheId: Joi.function().required(),
          handler: Joi.function().required(),
        })
        .required()
        .validateAsync(handler);

      this.cacheEventHandlers.push(
        new CacheEventHandler({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregateName),
            context: snakeCase(handler.context || this.options.domain.context),
          },
          cache: {
            name: snakeCase(cacheName),
            context: snakeCase(this.options.domain.context),
          },
          conditions: handler.conditions,
          getCacheId: handler.getCacheId,
          handler: handler.handler,
        }),
      );
    }
  }

  private async scanSagas(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.sagas.directory,
      this.options.sagas.extensions,
    );

    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./sagas/{sagaName}/{aggregateName}/{eventName} ]",
        );
      }

      const sagaName = file.parents[1];
      const aggregateName = file.parents[0];

      if (!this.isValid("saga", sagaName, this.options.sagas)) break;

      const handler = this.options.require(file.path).default;

      await Joi.object<SagaEventHandlerFile>()
        .keys({
          context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional(),
          conditions: Joi.object<HandlerConditions>()
            .keys({
              created: Joi.boolean().optional(),
              permanent: Joi.boolean().optional(),
            })
            .optional(),
          saveOptions: Joi.object<SagaStoreSaveOptions>()
            .keys({
              causationsCap: Joi.number().optional(),
            })
            .optional(),
          getSagaId: Joi.function().required(),
          handler: Joi.function().required(),
        })
        .required()
        .validateAsync(handler);

      this.sagaEventHandlers.push(
        new SagaEventHandler({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregateName),
            context: snakeCase(handler.context || this.options.domain.context),
          },
          saga: {
            name: snakeCase(sagaName),
            context: snakeCase(this.options.domain.context),
          },
          conditions: handler.conditions,
          saveOptions: handler.saveOptions,
          getSagaId: handler.getSagaId,
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
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting folder structure: [ ./views/{viewName}/{aggregateName}/{eventName} ]",
        );
      }

      const viewName = file.parents[1];
      const aggregateName = file.parents[0];

      if (!this.isValid("view", viewName, this.options.views)) break;

      const handler = this.options.require(file.path).default;

      await Joi.object<ViewEventHandlerFile>()
        .keys({
          conditions: Joi.object<HandlerConditions>()
            .keys({
              created: Joi.boolean().optional(),
              permanent: Joi.boolean().optional(),
            })
            .optional(),
          context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional(),
          documentOptions: Joi.object<ViewStoreDocumentOptions>()
            .keys({
              indices: Joi.array().items(
                Joi.object<StoreBaseIndex>().keys({
                  indexSpecification: Joi.object().required(),
                  createIndexesOptions: Joi.object().required(),
                }),
              ),
            })
            .optional(),
          getViewId: Joi.function().required(),
          handler: Joi.function().required(),
        })
        .required()
        .validateAsync(handler);

      this.viewEventHandlers.push(
        new ViewEventHandler({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregateName),
            context: snakeCase(handler.context || this.options.domain.context),
          },
          view: {
            name: snakeCase(viewName),
            context: snakeCase(this.options.domain.context),
          },
          conditions: handler.conditions,
          documentOptions: handler.documentOptions,
          getViewId: handler.getViewId,
          handler: handler.handler,
        }),
      );
    }
  }

  // private helpers

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

    Promise.all([
      this.aggregateDomain.removeAllCommandHandlers(),
      this.aggregateDomain.removeAllEventHandlers(),
      this.sagaDomain.removeAllEventHandlers(),
    ])
      .then(() => {
        this.logger.verbose("Removed handlers");
      })
      .catch((err) => {
        this.logger.error("Failed to remove handlers", err);
      });
  }

  private onReplayStop(): void {
    Promise.all([
      this.registerAggregateCommandHandlers(this.aggregateCommandHandlers),
      this.registerAggregateEventHandlers(this.aggregateEventHandlers),
      this.registerSagaEventHandlers(this.sagaEventHandlers),
    ])
      .then(() => {
        this.logger.verbose("Registered handlers");
        this.replaying = false;
      })
      .catch((err) => {
        this.logger.error("Failed to register handlers", err);
      });
  }
}
