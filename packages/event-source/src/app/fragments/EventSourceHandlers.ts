import { EventSourceDomains } from "./EventSourceDomains";
import { EventSourceStores } from "./EventSourceStores";
import { LindormError } from "@lindorm-io/errors";
import { flatten, uniq } from "lodash";
import {
  IAggregateCommandHandler,
  IAggregateEventHandler,
  ISagaEventHandler,
  IViewEventHandler,
  PrivateAppOptions,
} from "../../types";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../../handler";

export class EventSourceHandlers {
  private readonly domains: EventSourceDomains;
  private readonly stores: EventSourceStores;
  private readonly options: PrivateAppOptions;

  public readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  public readonly aggregateEventHandlers: Array<IAggregateEventHandler>;
  public readonly sagaEventHandlers: Array<ISagaEventHandler>;
  public readonly viewEventHandlers: Array<IViewEventHandler>;

  public readonly commandAggregates: Record<string, Array<string>>;
  public readonly eventAggregates: Record<string, Array<string>>;

  public constructor(
    options: PrivateAppOptions,
    domains: EventSourceDomains,
    stores: EventSourceStores,
  ) {
    this.options = options;
    this.domains = domains;
    this.stores = stores;

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

    this.commandAggregates = {};
    this.eventAggregates = {};
  }

  public async registerAggregateCommandHandlers(
    handlers: Array<AggregateCommandHandlerImplementation>,
  ): Promise<void> {
    for (const handler of handlers) {
      await this.domains.aggregate.registerCommandHandler(handler);
    }
  }

  public async registerAggregateEventHandlers(
    handlers: Array<AggregateEventHandlerImplementation>,
  ): Promise<void> {
    for (const handler of handlers) {
      await this.domains.aggregate.registerEventHandler(handler);
    }
  }

  public async registerSagaEventHandlers(
    handlers: Array<SagaEventHandlerImplementation>,
  ): Promise<void> {
    for (const handler of handlers) {
      await this.domains.saga.registerEventHandler(handler);
    }
  }

  public async registerViewEventHandlers(
    handlers: Array<ViewEventHandlerImplementation>,
  ): Promise<void> {
    for (const handler of handlers) {
      await this.domains.view.registerEventHandler(handler);
    }

    this.registerViewEntities(handlers);
    this.registerViewIndices(handlers);
  }

  public registerViewEntities(handlers: Array<ViewEventHandlerImplementation>): void {
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

      this.stores.viewEntities[this.viewEntityName(handler.view.name, handler.view.context)] =
        handler.adapters.postgres.ViewEntity;
    }
  }

  public registerViewIndices(handlers: Array<ViewEventHandlerImplementation>): void {
    for (const handler of handlers) {
      if (!handler.adapters.mongo) continue;

      this.stores.viewIndices[this.viewEntityName(handler.view.name, handler.view.context)] = {
        view: handler.view,
        collection: handler.adapters.mongo.collection,
        indices: handler.adapters.mongo.indices,
      };
    }
  }

  public registerCommandAggregate(name: string, aggregate: string): void {
    const current = this.commandAggregates[name] || [];
    this.commandAggregates[name] = uniq(flatten([current, aggregate]));
  }

  public registerEventAggregate(name: string, aggregate: string): void {
    const current = this.eventAggregates[name] || [];
    this.eventAggregates[name] = uniq(flatten([current, aggregate]));
  }

  public context(context?: string): string {
    return context || this.options.context;
  }

  public viewEntityName(name: string, context?: string): string {
    return `view_${this.context(context)}_${name}`;
  }
}
