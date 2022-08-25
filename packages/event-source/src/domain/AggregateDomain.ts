import { Aggregate } from "../entity";
import { Command, ErrorMessage } from "../message";
import { ExtendableError, LindormError } from "@lindorm-io/errors";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import { assertSnakeCase } from "../util";
import { cloneDeep, filter, find, findLast, remove, some } from "lodash";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
} from "../handler";
import {
  AggregateCommandHandlerContext,
  AggregateDomainOptions,
  AggregateIdentifier,
  IAggregateCommandHandler,
  IAggregateDomain,
  IAggregateEventHandler,
  IDomainEventStore,
  State,
} from "../types";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../error";

export class AggregateDomain implements IAggregateDomain {
  private readonly commandHandlers: Array<IAggregateCommandHandler>;
  private readonly eventHandlers: Array<IAggregateEventHandler>;
  private readonly logger: ILogger;
  private readonly messageBus: IMessageBus;
  private readonly store: IDomainEventStore;

  public constructor(options: AggregateDomainOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["AggregateDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.commandHandlers = [];
    this.eventHandlers = [];
  }

  public async registerCommandHandler(
    commandHandler: AggregateCommandHandlerImplementation,
  ): Promise<void> {
    this.logger.debug("Registering command handler", {
      aggregate: commandHandler.aggregate,
      commandName: commandHandler.commandName,
      version: commandHandler.version,
    });

    if (!(commandHandler instanceof AggregateCommandHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateDomainCommandHandler",
          actual: typeof commandHandler,
        },
      });
    }

    const existingHandler = some(this.commandHandlers, {
      commandName: commandHandler.commandName,
      version: commandHandler.version,
      aggregate: {
        name: commandHandler.aggregate.name,
        context: commandHandler.aggregate.context,
      },
    });

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

    assertSnakeCase(commandHandler.aggregate.context);
    assertSnakeCase(commandHandler.aggregate.name);
    assertSnakeCase(commandHandler.commandName);

    this.commandHandlers.push(commandHandler);

    await this.messageBus.subscribe({
      callback: (command: Command) => this.handleCommand(command),
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

  public async registerEventHandler(
    eventHandler: AggregateEventHandlerImplementation,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });

    if (!(eventHandler instanceof AggregateEventHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateEventHandler",
          actual: typeof eventHandler,
        },
      });
    }

    const existingHandler = some(this.eventHandlers, {
      eventName: eventHandler.eventName,
      version: eventHandler.version,
      aggregate: {
        name: eventHandler.aggregate.name,
        context: eventHandler.aggregate.context,
      },
    });

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

    assertSnakeCase(eventHandler.aggregate.context);
    assertSnakeCase(eventHandler.aggregate.name);
    assertSnakeCase(eventHandler.eventName);

    this.eventHandlers.push(eventHandler);

    this.logger.debug("Event handler registered", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });
  }

  public async removeCommandHandler(
    commandHandler: AggregateCommandHandlerImplementation,
  ): Promise<void> {
    this.logger.debug("Removing command handler", {
      aggregate: commandHandler.aggregate,
      commandName: commandHandler.commandName,
      version: commandHandler.version,
    });

    if (!(commandHandler instanceof AggregateCommandHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateDomainCommandHandler",
          actual: typeof commandHandler,
        },
      });
    }

    remove(this.commandHandlers, {
      aggregate: {
        name: commandHandler.aggregate.name,
        context: commandHandler.aggregate.context,
      },
      commandName: commandHandler.commandName,
      version: commandHandler.version,
    });

    await this.messageBus.unsubscribe({
      queue: AggregateDomain.getQueue(commandHandler),
      topic: AggregateDomain.getTopic(commandHandler),
    });

    this.logger.verbose("Command handler removed", {
      aggregate: commandHandler.aggregate,
      commandName: commandHandler.commandName,
      version: commandHandler.version,
    });
  }

  public async removeEventHandler(
    eventHandler: AggregateEventHandlerImplementation,
  ): Promise<void> {
    this.logger.debug("Removing event handler", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });

    if (!(eventHandler instanceof AggregateEventHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateEventHandler",
          actual: typeof eventHandler,
        },
      });
    }

    remove(this.eventHandlers, {
      aggregate: {
        name: eventHandler.aggregate.name,
        context: eventHandler.aggregate.context,
      },
      eventName: eventHandler.eventName,
    });

    this.logger.verbose("Event handler removed", {
      aggregate: eventHandler.aggregate,
      eventName: eventHandler.eventName,
      version: eventHandler.version,
    });
  }

  public async removeAllCommandHandlers(): Promise<void> {
    for (const handler of this.commandHandlers) {
      await this.removeCommandHandler(handler);
    }
  }

  public async removeAllEventHandlers(): Promise<void> {
    for (const handler of this.eventHandlers) {
      await this.removeEventHandler(handler);
    }
  }

  public async inspect<TState extends State = State>(
    identifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>> {
    return (await this.store.load(identifier, this.eventHandlers)) as Aggregate<TState>;
  }

  // private

  private async handleCommand(command: Command): Promise<void> {
    this.logger.debug("Handling command", { command });

    const conditionValidators = [];

    const commandHandler = find(this.commandHandlers, {
      commandName: command.name,
      version: command.version,
      aggregate: {
        name: command.aggregate.name,
        context: command.aggregate.context,
      },
    });

    if (!(commandHandler instanceof AggregateCommandHandlerImplementation)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((aggregate: Aggregate) => {
      if (aggregate.destroyed) {
        throw new AggregateDestroyedError();
      }
    });

    if (commandHandler.conditions?.created === true) {
      conditionValidators.push((aggregate: Aggregate) => {
        if (aggregate.events.length < 1) {
          throw new AggregateNotCreatedError();
        }
      });
    }

    if (commandHandler.conditions?.created === false) {
      conditionValidators.push((aggregate: Aggregate) => {
        if (aggregate.events.length > 0) {
          throw new AggregateAlreadyCreatedError();
        }
      });
    }

    const eventHandlers = filter(this.eventHandlers, {
      aggregate: {
        name: command.aggregate.name,
        context: command.aggregate.context,
      },
    });

    const aggregate = await this.store.load(command.aggregate, eventHandlers);
    const lastCausationMatchesCommandId = findLast(aggregate.events, {
      causationId: command.id,
    });

    try {
      if (!lastCausationMatchesCommandId) {
        try {
          await commandHandler.schema.validateAsync(command.data);
        } catch (err) {
          throw new CommandSchemaValidationError(err);
        }

        for (const validator of conditionValidators) {
          validator(aggregate);
        }

        const context: AggregateCommandHandlerContext = {
          command: cloneDeep(command.data),
          logger: this.logger.createChildLogger(["AggregateCommandHandler"]),
          state: cloneDeep(aggregate.state),

          apply: aggregate.apply.bind(aggregate, command),
        };

        await commandHandler.handler(context);
      }

      const events = await this.store.save(aggregate, command);
      await this.messageBus.publish(events);

      this.logger.verbose("Handled command", { command });
    } catch (err) {
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

  private async rejectCommand(command: Command, error: ExtendableError): Promise<void> {
    this.logger.debug("Rejecting command", { command, error });

    try {
      await this.messageBus.publish([
        new ErrorMessage(
          {
            name: error.name,
            aggregate: command.aggregate,
            data: { error, message: command },
            mandatory: true,
            origin: "aggregate_domain",
          },
          command,
        ),
      ]);

      this.logger.verbose("Rejected command", { command, error });
    } catch (err) {
      this.logger.error("Failed to reject command", err);

      throw err;
    }
  }

  // private static

  private static getQueue(commandHandler: AggregateCommandHandlerImplementation): string {
    return `queue.aggregate.${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }

  private static getTopic(commandHandler: AggregateCommandHandlerImplementation): string {
    return `${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }
}
