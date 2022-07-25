import { Aggregate } from "../entity";
import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { EventStore, MessageBus } from "../infrastructure";
import { ExtendableError, LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { filter, find, findLast, some } from "lodash";
import {
  AggregateCommandHandlerContext,
  AggregateDomainOptions,
  AggregateIdentifier,
  IAggregateDomain,
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
  private readonly commandHandlers: Array<AggregateCommandHandler>;
  private readonly eventHandlers: Array<AggregateEventHandler>;
  private readonly logger: Logger;
  private readonly messageBus: MessageBus;
  private readonly store: EventStore;

  public constructor(options: AggregateDomainOptions) {
    this.logger = options.logger.createChildLogger(["AggregateDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.commandHandlers = [];
    this.eventHandlers = [];
  }

  public async inspect<S extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Aggregate<S>> {
    return await this.store.load<S>(aggregateIdentifier, this.eventHandlers);
  }

  public async registerCommandHandler(commandHandler: AggregateCommandHandler): Promise<void> {
    this.logger.debug("Register AggregateCommandHandler initialised", {
      name: commandHandler.commandName,
    });

    const existingHandler = some(this.commandHandlers, {
      aggregate: {
        name: commandHandler.aggregate.name,
        context: commandHandler.aggregate.context,
      },
      commandName: commandHandler.commandName,
    });

    if (existingHandler) {
      throw new LindormError("Command handler already registered");
    }

    if (!(commandHandler instanceof AggregateCommandHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateDomainCommandHandler",
          actual: typeof commandHandler,
        },
      });
    }

    this.commandHandlers.push(commandHandler);

    await this.messageBus.subscribe({
      callback: (command: Command) => this.handleCommand(command),
      queue: AggregateDomain.getQueue(commandHandler),
      routingKey: AggregateDomain.getRoutingKey(commandHandler),
    });

    this.logger.verbose("Register AggregateCommandHandler successful", {
      name: commandHandler.commandName,
      aggregate: commandHandler.aggregate,
      conditions: commandHandler.conditions,
    });
  }

  public async registerEventHandler(eventHandler: AggregateEventHandler): Promise<void> {
    this.logger.debug("registering event handler", { name: eventHandler.eventName });

    if (!(eventHandler instanceof AggregateEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "AggregateEventHandler",
          actual: typeof eventHandler,
        },
      });
    }

    const existingHandler = some(this.eventHandlers, {
      aggregate: {
        name: eventHandler.aggregate.name,
        context: eventHandler.aggregate.context,
      },
      eventName: eventHandler.eventName,
    });

    if (existingHandler) {
      throw new LindormError("Event handler already registered");
    }

    this.eventHandlers.push(eventHandler);

    this.logger.debug("aggregate event handler registered", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
    });
  }

  // private

  private async handleCommand(command: Command): Promise<void> {
    this.logger.debug("Handle Command initialised", { command });

    const conditionValidators = [];

    const commandHandler = find(this.commandHandlers, {
      aggregate: {
        name: command.aggregate.name,
        context: command.aggregate.context,
      },
      commandName: command.name,
    });

    if (!(commandHandler instanceof AggregateCommandHandler)) {
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
          command,
          logger: this.logger.createChildLogger(["AggregateCommandHandler"]),

          apply: aggregate.apply.bind(aggregate, command),
          getState: aggregate.getState.bind(aggregate),
        };

        await commandHandler.handler(context);
      }

      const events = await this.store.save(aggregate, command);
      await this.messageBus.publish(events);

      this.logger.verbose("Handle Command successful", { command });
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling command", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling command", err);
      } else {
        this.logger.error("Handle Command failed", err);
      }

      if (err instanceof DomainError && err.permanent) {
        await this.rejectCommand(command, err);
      }

      throw err;
    }
  }

  private async rejectCommand(command: Command, error: ExtendableError): Promise<void> {
    this.logger.debug("Reject Command initialised", { command });

    try {
      await this.messageBus.publish([
        new DomainEvent(
          {
            name: error.name,
            aggregate: command.aggregate,
            data: { error, message: command },
            mandatory: true,
          },
          command,
        ),
      ]);

      this.logger.verbose("Reject Command successful", { command });
    } catch (err) {
      this.logger.error("Reject Command failed", { command });

      throw err;
    }
  }

  // private static

  private static getQueue(commandHandler: AggregateCommandHandler): string {
    return `queue.aggregate.${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }

  private static getRoutingKey(commandHandler: AggregateCommandHandler): string {
    return `${commandHandler.aggregate.context}.${commandHandler.aggregate.name}.${commandHandler.commandName}`;
  }
}
