import Joi from "joi";
import { Aggregate } from "../entity";
import { AggregateDomain, CacheDomain, SagaDomain, ViewDomain } from "../domain";
import { AmqpConnection } from "@lindorm-io/amqp";
import { Command } from "../message";
import { Filter, FindOptions } from "mongodb";
import { JOI_MESSAGE } from "../constant";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { StructureScanner } from "../util";
import { join } from "path";
import { merge } from "lodash";
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
  PublishCommandOptions,
  SagaEventHandlerFile,
  SagaStoreSaveOptions,
  State,
  StoreBaseIndex,
  ViewEventHandlerFile,
  ViewStoreAttributes,
  ViewStoreDocumentOptions,
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
  private readonly viewDomain: ViewDomain;

  private promise: () => Promise<void>;
  private initialised: boolean;

  public constructor(options: EventDomainAppOptions) {
    const { amqp, mongo, redis, logger, ...appOptions } = options;

    this.logger = logger.createChildLogger(["EventDomainApp"]);

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

    this.messageBus = new MessageBus({
      connection: this.amqp,
      logger: this.logger,
    });

    this.aggregateDomain = new AggregateDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new EventStore({
        connection: this.mongo,
        database: this.options.domain.database,
        logger: this.logger,
      }),
    });

    this.sagaDomain = new SagaDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new SagaStore({
        connection: this.mongo,
        database: this.options.domain.database,
        logger: this.logger,
      }),
    });

    this.viewDomain = new ViewDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new ViewStore({
        connection: this.mongo,
        database: this.options.domain.database,
        logger: this.logger,
      }),
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

    this.promise = this.initialise;
  }

  // public properties

  public get isInitialised(): boolean {
    return this.initialised;
  }
  public set isInitialised(_: boolean) {
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
    return new ViewRepository<S>({
      collection: options.collection,
      connection: this.mongo,
      database: options.database || this.options.domain.database,
      indices: options.indices,
      logger: this.logger,
      view: {
        name,
        context: options.context || this.options.domain.context,
      },
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
    if (eventName.startsWith("view")) {
      this.viewDomain.on(eventName, listener);
    }
    if (eventName.startsWith("cache")) {
      this.cacheDomain.on(eventName, listener);
    }
  }

  public async publish(options: PublishCommandOptions): Promise<void> {
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

    await this.promise();

    return this.messageBus.publish(command);
  }

  public async query<S extends State = State>(
    documentOptions: ViewStoreDocumentOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes<S>>> {
    await this.promise();

    return this.viewDomain.query<S>(documentOptions, filter, findOptions);
  }

  // public test methods

  public async dangerouslyRegisterAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandler>,
  ): Promise<void> {
    if (!this.options.dangerouslyRegisterHandlersManually) {
      throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
    }

    for (const handler of handlers) {
      await this.aggregateDomain.registerCommandHandler(handler);
    }
  }

  public async dangerouslyRegisterAggregateEventHandlers(
    handlers: Array<AggregateEventHandler>,
  ): Promise<void> {
    if (!this.options.dangerouslyRegisterHandlersManually) {
      throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
    }

    for (const handler of handlers) {
      await this.aggregateDomain.registerEventHandler(handler);
    }
  }

  public async dangerouslyRegisterCacheEventHandlers(
    handlers: Array<CacheEventHandler>,
  ): Promise<void> {
    if (!this.options.dangerouslyRegisterHandlersManually) {
      throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
    }

    for (const handler of handlers) {
      await this.cacheDomain.registerEventHandler(handler);
    }
  }

  public async dangerouslyRegisterSagaEventHandlers(
    handlers: Array<SagaEventHandler>,
  ): Promise<void> {
    if (!this.options.dangerouslyRegisterHandlersManually) {
      throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
    }

    for (const handler of handlers) {
      await this.sagaDomain.registerEventHandler(handler);
    }
  }

  public async dangerouslyRegisterViewEventHandlers(
    handlers: Array<ViewEventHandler>,
  ): Promise<void> {
    if (!this.options.dangerouslyRegisterHandlersManually) {
      throw new Error("Set option [ dangerouslyRegisterHandlersManually ] to [ true ]");
    }

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

    if (StructureScanner.hasFiles(this.options.aggregates.directory)) {
      await this.scanAggregates();
    }

    if (StructureScanner.hasFiles(this.options.caches.directory)) {
      await this.scanCaches();
    }

    if (StructureScanner.hasFiles(this.options.sagas.directory)) {
      await this.scanSagas();
    }

    if (StructureScanner.hasFiles(this.options.views.directory)) {
      await this.scanViews();
    }

    this.initialised = true;
    this.promise = (): Promise<void> => Promise.resolve();
  }

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

          await this.aggregateDomain.registerCommandHandler(
            new AggregateCommandHandler({
              commandName: file.name,
              aggregate: {
                name: aggregateName,
                context: this.options.domain.context,
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

          await this.aggregateDomain.registerEventHandler(
            new AggregateEventHandler({
              eventName: file.name,
              aggregate: {
                name: aggregateName,
                context: this.options.domain.context,
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

      await this.cacheDomain.registerEventHandler(
        new CacheEventHandler({
          eventName: file.name,
          aggregate: {
            name: aggregateName,
            context: handler.context || this.options.domain.context,
          },
          cache: {
            name: cacheName,
            context: this.options.domain.context,
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

      await this.sagaDomain.registerEventHandler(
        new SagaEventHandler({
          eventName: file.name,
          aggregate: {
            name: aggregateName,
            context: handler.context || this.options.domain.context,
          },
          saga: {
            name: sagaName,
            context: this.options.domain.context,
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
              collection: Joi.string().required(),
              database: Joi.string().optional(),
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

      await this.viewDomain.registerEventHandler(
        new ViewEventHandler({
          eventName: file.name,
          aggregate: {
            name: aggregateName,
            context: handler.context || this.options.domain.context,
          },
          view: {
            name: viewName,
            context: this.options.domain.context,
          },
          conditions: handler.conditions,
          documentOptions: handler.documentOptions,
          getViewId: handler.getViewId,
          handler: handler.handler,
        }),
      );
    }
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
}
