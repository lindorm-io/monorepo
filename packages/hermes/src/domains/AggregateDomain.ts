import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { findLast } from "@lindorm/utils";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CausationMissingEventsError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../errors";
import { HermesAggregateCommandHandler, HermesAggregateEventHandler } from "../handlers";
import {
  IAggregate,
  IAggregateDomain,
  IEventStore,
  IHermesAggregateCommandHandler,
  IHermesAggregateEventHandler,
  IHermesMessage,
  IHermesMessageBus,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { Aggregate } from "../models";
import {
  AggregateCommandHandlerContext,
  AggregateIdentifier,
  EventStoreAttributes,
} from "../types";
import { AggregateDomainOptions } from "../types/domain";
import { assertChecksum, createChecksum } from "../utils/private";

export class AggregateDomain implements IAggregateDomain {
  private readonly commandHandlers: Array<IHermesAggregateCommandHandler>;
  private readonly eventHandlers: Array<IHermesAggregateEventHandler>;
  private readonly logger: ILogger;
  private readonly messageBus: IHermesMessageBus;
  private readonly store: IEventStore;

  public constructor(options: AggregateDomainOptions) {
    this.logger = options.logger.child(["AggregateDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.commandHandlers = [];
    this.eventHandlers = [];
  }

  public async registerCommandHandler<T extends ClassLike = ClassLike>(
    commandHandler: HermesAggregateCommandHandler<T>,
  ): Promise<void> {
    this.logger.debug("Registering command handler", {
      aggregate: commandHandler.aggregate,
      commandName: commandHandler.commandName,
      version: commandHandler.version,
    });

    if (!(commandHandler instanceof HermesAggregateCommandHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateDomainCommandHandler",
          actual: typeof commandHandler,
        },
      });
    }

    const existingHandler = this.commandHandlers.some(
      (x) =>
        x.commandName === commandHandler.commandName &&
        x.version === commandHandler.version &&
        x.aggregate.name === commandHandler.aggregate.name &&
        x.aggregate.context === commandHandler.aggregate.context,
    );

    if (existingHandler) {
      throw new LindormError("Command handler already registered", {
        debug: {
          commandName: commandHandler.commandName,
          version: commandHandler.version,
          aggregate: {
            name: commandHandler.aggregate.name,
            context: commandHandler.aggregate.context,
          },
        },
      });
    }

    this.commandHandlers.push(commandHandler);

    await this.messageBus.subscribe({
      callback: (command: HermesCommand) => this.handleCommand(command),
      queue: AggregateDomain.getQueue(commandHandler),
      topic: AggregateDomain.getTopic(commandHandler),
    });

    this.logger.verbose("Registered command handler", {
      commandName: commandHandler.commandName,
      aggregate: commandHandler.aggregate,
      version: commandHandler.version,
      conditions: commandHandler.conditions,
    });
  }

  public async registerEventHandler<T extends ClassLike = ClassLike>(
    eventHandler: HermesAggregateEventHandler<T>,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });

    if (!(eventHandler instanceof HermesAggregateEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateEventHandler",
          actual: typeof eventHandler,
        },
      });
    }

    const existingHandler = this.eventHandlers.some(
      (x) =>
        x.eventName === eventHandler.eventName &&
        x.version === eventHandler.version &&
        x.aggregate.name === eventHandler.aggregate.name &&
        x.aggregate.context === eventHandler.aggregate.context,
    );

    if (existingHandler) {
      throw new LindormError("Event handler already registered", {
        debug: {
          eventName: eventHandler.eventName,
          version: eventHandler.version,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: eventHandler.aggregate.context,
          },
        },
      });
    }

    this.eventHandlers.push(eventHandler);

    this.logger.debug("Event handler registered", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });
  }

  public async inspect<S extends Dict = Dict>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<IAggregate<S>> {
    return (await this.load(aggregateIdentifier, this.eventHandlers)) as IAggregate<S>;
  }

  // private

  private async handleCommand(command: HermesCommand): Promise<void> {
    this.logger.debug("Handling command", { command });

    const conditionValidators = [];

    const commandHandler = this.commandHandlers.find(
      (x) =>
        x.commandName === command.name &&
        x.version === command.version &&
        x.aggregate.name === command.aggregate.name &&
        x.aggregate.context === command.aggregate.context,
    );

    if (!(commandHandler instanceof HermesAggregateCommandHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((aggregate: IAggregate) => {
      if (aggregate.destroyed) {
        throw new AggregateDestroyedError();
      }
    });

    if (commandHandler.conditions?.created === true) {
      conditionValidators.push((aggregate: IAggregate) => {
        if (aggregate.events.length < 1) {
          throw new AggregateNotCreatedError();
        }
      });
    }

    if (commandHandler.conditions?.created === false) {
      conditionValidators.push((aggregate: IAggregate) => {
        if (aggregate.events.length > 0) {
          throw new AggregateAlreadyCreatedError();
        }
      });
    }

    const eventHandlers = this.eventHandlers.filter(
      (x) =>
        x.aggregate.name === command.aggregate.name &&
        x.aggregate.context === command.aggregate.context,
    );

    const aggregate = await this.load(command.aggregate, eventHandlers);
    const lastCausationMatchesCommandId = findLast(aggregate.events, {
      causationId: command.id,
    });

    try {
      if (!lastCausationMatchesCommandId) {
        if (commandHandler.schema) {
          try {
            await commandHandler.schema.parse(command.data);
          } catch (error: any) {
            throw new CommandSchemaValidationError(error);
          }
        }

        for (const validator of conditionValidators) {
          validator(aggregate);
        }

        const ctx: AggregateCommandHandlerContext = {
          command: structuredClone(command.data),
          logger: this.logger.child(["AggregateCommandHandler"]),
          state: structuredClone(aggregate.state),

          apply: aggregate.apply.bind(aggregate, command),
        };

        await commandHandler.handler(ctx);
      }

      const events = await this.save(aggregate, command);

      await this.messageBus.publish(events);

      this.logger.verbose("Handled command", { command });
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling command", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling command", err);
      } else {
        this.logger.error("Failed to handle command", err);
      }

      if (err instanceof DomainError && err.permanent) {
        await this.rejectCommand(command, err);
      }

      throw err;
    }
  }

  private async rejectCommand(command: HermesCommand, error: Error): Promise<void> {
    this.logger.debug("Rejecting command", { command, error });

    try {
      await this.messageBus.publish([
        new HermesError(
          {
            name: snakeCase(error.name),
            aggregate: command.aggregate,
            data: {
              error,
              message: command,
            },
            meta: command.meta,
            mandatory: true,
          },
          command,
        ),
      ]);

      this.logger.verbose("Rejected command", { command, error });
    } catch (err: any) {
      this.logger.error("Failed to reject command", err);

      throw err;
    }
  }

  private async load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<IHermesAggregateEventHandler>,
  ): Promise<IAggregate<Dict>> {
    this.logger.debug("Loading aggregate", { aggregateIdentifier });

    const data = await this.store.find(aggregateIdentifier);

    this.warnIfChecksumMismatch(data);

    const events = data.map((item) => AggregateDomain.toHermesEvent(item));

    const aggregate = new Aggregate({
      ...aggregateIdentifier,
      eventHandlers,
      logger: this.logger,
    });

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded aggregate", { aggregate: aggregate.toJSON() });

    return aggregate;
  }

  private async save(
    aggregate: IAggregate,
    causation: IHermesMessage,
  ): Promise<Array<IHermesMessage>> {
    this.logger.debug("Saving aggregate", { aggregate: aggregate.toJSON(), causation });

    const events = await this.store.find({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,
      causation_id: causation.id,
    });

    if (events?.length) {
      this.logger.debug("Found events matching causation", { events });

      return events.map((item) => AggregateDomain.toHermesEvent(item));
    }

    const causationEvents = aggregate.events.filter(
      (x) => x.causationId === causation.id,
    );

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    const expectedEvents = aggregate.events.slice(0, aggregate.numberOfLoadedEvents);
    const [lastExpectedEvent] = expectedEvents.reverse();

    this.logger.debug("Saving aggregate", {
      aggregate,
      causationEvents,
      expectedEvents,
      lastExpectedEvent,
    });

    const initialAttributes: Array<Omit<EventStoreAttributes, "checksum">> =
      causationEvents.map((event) => ({
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: causation.id,
        correlation_id: causation.correlationId,
        data: event.data,
        event_id: event.id,
        event_name: event.name,
        event_timestamp: event.timestamp,
        expected_events: expectedEvents.length,
        meta: event.meta,
        previous_event_id: lastExpectedEvent ? lastExpectedEvent.id : null,
        timestamp: new Date(),
        version: event.version,
      }));

    const attributes: Array<EventStoreAttributes> = initialAttributes.map((item) => ({
      ...item,
      checksum: createChecksum(item),
    }));

    await this.store.insert(attributes);

    return causationEvents;
  }

  private async warnIfChecksumMismatch(
    attributes: Array<EventStoreAttributes>,
  ): Promise<void> {
    for (const event of attributes) {
      try {
        assertChecksum(event);
      } catch (error: any) {
        this.logger.warn("Checksum mismatch", error, [{ event }]);
      }
    }
  }

  // private static

  private static getQueue<T extends ClassLike = ClassLike>(
    commandHandler: HermesAggregateCommandHandler<T>,
  ): string {
    return `queue.aggregate.${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }

  private static getTopic<T extends ClassLike = ClassLike>(
    commandHandler: HermesAggregateCommandHandler<T>,
  ): string {
    return `${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }

  private static toHermesEvent(data: EventStoreAttributes): HermesEvent {
    return new HermesEvent({
      id: data.event_id,
      name: data.event_name,
      aggregate: {
        id: data.aggregate_id,
        name: data.aggregate_name,
        context: data.aggregate_context,
      },
      causationId: data.causation_id,
      correlationId: data.correlation_id,
      data: data.data,
      meta: data.meta,
      timestamp: data.event_timestamp,
      version: data.version,
    });
  }
}