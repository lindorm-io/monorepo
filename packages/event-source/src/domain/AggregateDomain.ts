import { IMessageBus } from "@lindorm-io/amqp";
import { snakeCase } from "@lindorm-io/case";
import { Logger } from "@lindorm-io/core-logger";
import { ExtendableError, LindormError } from "@lindorm-io/errors";
import clone from "clone";
import { findLast } from "lodash";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../error";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
} from "../handler";
import { Command, ErrorMessage } from "../message";
import { Aggregate } from "../model";
import {
  AggregateCommandHandlerContext,
  AggregateDomainOptions,
  AggregateIdentifier,
  DtoClass,
  IAggregateCommandHandler,
  IAggregateDomain,
  IAggregateEventHandler,
  IDomainEventStore,
  State,
} from "../types";
import { assertSnakeCase } from "../util";

export class AggregateDomain implements IAggregateDomain {
  private readonly commandHandlers: Array<IAggregateCommandHandler>;
  private readonly eventHandlers: Array<IAggregateEventHandler>;
  private readonly logger: Logger;
  private readonly messageBus: IMessageBus;
  private readonly store: IDomainEventStore;

  public constructor(options: AggregateDomainOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["AggregateDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.commandHandlers = [];
    this.eventHandlers = [];
  }

  public async registerCommandHandler<T extends DtoClass = DtoClass>(
    commandHandler: AggregateCommandHandlerImplementation<T>,
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

  public async registerEventHandler<T extends DtoClass = DtoClass>(
    eventHandler: AggregateEventHandlerImplementation<T>,
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

  public async unsubscribeCommandHandlers(): Promise<void> {
    this.logger.debug("Unsubscribing command handlers");

    for (const handler of this.commandHandlers) {
      await this.messageBus.unsubscribe({
        queue: AggregateDomain.getQueue(handler),
        topic: AggregateDomain.getTopic(handler),
      });

      this.logger.verbose("Command handler unsubscribed", {
        aggregate: handler.aggregate,
        commandName: handler.commandName,
        version: handler.version,
      });
    }
  }

  public async resubscribeCommandHandlers(): Promise<void> {
    this.logger.debug("Resubscribing command handlers");

    for (const handler of this.commandHandlers) {
      await this.messageBus.subscribe({
        callback: (command: Command) => this.handleCommand(command),
        queue: AggregateDomain.getQueue(handler),
        topic: AggregateDomain.getTopic(handler),
      });

      this.logger.verbose("Command handler resubscribed", {
        aggregate: handler.aggregate,
        commandName: handler.commandName,
        version: handler.version,
      });
    }
  }

  public async inspect<TState extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<TState>> {
    return (await this.store.load(aggregateIdentifier, this.eventHandlers)) as Aggregate<TState>;
  }

  // private

  private async handleCommand(command: Command): Promise<void> {
    this.logger.debug("Handling command", { command });

    const conditionValidators = [];

    const commandHandler = this.commandHandlers.find(
      (x) =>
        x.commandName === command.name &&
        x.version === command.version &&
        x.aggregate.name === command.aggregate.name &&
        x.aggregate.context === command.aggregate.context,
    );

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

    const eventHandlers = this.eventHandlers.filter(
      (x) =>
        x.aggregate.name === command.aggregate.name &&
        x.aggregate.context === command.aggregate.context,
    );

    const aggregate = await this.store.load(command.aggregate, eventHandlers);
    const lastCausationMatchesCommandId = findLast(aggregate.events, {
      causationId: command.id,
    });

    try {
      if (!lastCausationMatchesCommandId) {
        if (commandHandler.schema) {
          try {
            await commandHandler.schema.validateAsync(command.data);
          } catch (err: any) {
            throw new CommandSchemaValidationError(err);
          }
        }

        for (const validator of conditionValidators) {
          validator(aggregate);
        }

        const ctx: AggregateCommandHandlerContext = {
          command: clone(command.data),
          logger: this.logger.createChildLogger(["AggregateCommandHandler"]),
          state: clone(aggregate.state),

          apply: aggregate.apply.bind(aggregate, command),
        };

        await commandHandler.handler(ctx);
      }

      const events = await this.store.save(aggregate, command);

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

  private async rejectCommand(command: Command, error: ExtendableError): Promise<void> {
    this.logger.debug("Rejecting command", { command, error });

    try {
      await this.messageBus.publish([
        new ErrorMessage(
          {
            name: snakeCase(error.name),
            aggregate: command.aggregate,
            data: {
              error,
              message: command,
            },
            metadata: command.metadata,
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

  // private static

  private static getQueue<T extends DtoClass = DtoClass>(
    commandHandler: AggregateCommandHandlerImplementation<T>,
  ): string {
    return `queue.aggregate.${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }

  private static getTopic<T extends DtoClass = DtoClass>(
    commandHandler: AggregateCommandHandlerImplementation<T>,
  ): string {
    return `${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }
}
