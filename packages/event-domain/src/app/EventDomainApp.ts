import Joi from "joi";
import { AggregateDomain, SagaDomain, ViewDomain } from "../domain";
import { Command } from "../message";
import { EventStore, MessageBus, SagaStore, ViewStore } from "../infrastructure";
import { Filter, FindOptions } from "mongodb";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { StructureScanner } from "../util";
import { View } from "../entity";
import { join } from "path";
import { merge } from "lodash";
import { JOI_MESSAGE } from "../constant";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";
import {
  AggregateCommandHandlerFile,
  AggregateEventHandlerFile,
  AppOptions,
  AppStructure,
  EventDomainAppOptions,
  EventEmitterCallback,
  EventEmitterEvt,
  HandlerConditions,
  PublishCommandOptions,
  SagaEventHandlerFile,
  SagaStoreSaveOptions,
  ViewEventHandlerFile,
  ViewStoreAttributes,
  ViewStoreDocumentOptions,
  StoreBaseIndex,
} from "../types";

export class EventDomainApp {
  private readonly aggregateDomain: AggregateDomain;
  private readonly logger: Logger;
  private readonly messageBus: MessageBus;
  private readonly options: AppOptions;
  private readonly sagaDomain: SagaDomain;
  private readonly viewDomain: ViewDomain;

  private promise: () => Promise<void>;

  public constructor(options: EventDomainAppOptions) {
    const { amqp, database, logger, mongo, ...appOptions } = options;

    this.logger = logger.createChildLogger(["EventDomainApp"]);

    this.options = merge(
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

    this.messageBus = new MessageBus({
      connection: amqp,
      logger: this.logger,
    });

    this.aggregateDomain = new AggregateDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new EventStore({
        connection: mongo,
        logger: this.logger,
        database,
      }),
    });

    this.sagaDomain = new SagaDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new SagaStore({
        connection: mongo,
        logger: this.logger,
        database,
      }),
    });

    this.viewDomain = new ViewDomain({
      messageBus: this.messageBus,
      logger: this.logger,
      store: new ViewStore({
        connection: mongo,
        logger: this.logger,
        database,
      }),
    });

    this.promise = this.initialise;
  }

  // public

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

  public on<State>(evt: EventEmitterEvt, callback: EventEmitterCallback<State>): void {
    this.viewDomain.on(evt, callback);
  }

  public async query<State>(
    documentOptions: ViewStoreDocumentOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<View<State>>> {
    await this.promise();

    return this.viewDomain.query<State>(documentOptions, filter, findOptions);
  }

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
    if (this.options.dangerouslyRegisterHandlersManually) return;

    if (StructureScanner.hasFiles(this.options.aggregates.directory)) {
      await this.scanAggregates();
    }

    if (StructureScanner.hasFiles(this.options.sagas.directory)) {
      await this.scanSagas();
    }

    if (StructureScanner.hasFiles(this.options.views.directory)) {
      await this.scanViews();
    }

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
              aggregate: {
                name: aggregateName,
                context: this.options.domain.context,
              },
              commandName: file.name,
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
              aggregate: {
                name: aggregateName,
                context: this.options.domain.context,
              },
              eventName: file.name,
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
          aggregate: {
            name: aggregateName,
            context: handler.context || this.options.domain.context,
          },
          conditions: handler.conditions,
          eventName: file.name,
          getSagaId: handler.getSagaId,
          saga: {
            name: sagaName,
            context: this.options.domain.context,
          },
          saveOptions: handler.saveOptions,
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
          aggregate: {
            name: aggregateName,
            context: handler.context || this.options.domain.context,
          },
          conditions: handler.conditions,
          documentOptions: handler.documentOptions,
          eventName: file.name,
          getViewId: handler.getViewId,
          view: {
            name: viewName,
            context: this.options.domain.context,
          },
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
