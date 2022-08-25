import { EventSourceHandlers } from "./EventSourceHandlers";
import { ILogger } from "@lindorm-io/winston";
import { isArray, snakeCase } from "lodash";
import {
  assertSchema,
  defaultAggregateCommandHandlerSchema,
  defaultSagaIdFunction,
  defaultViewIdFunction,
  StructureScanner,
} from "../../util";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  AppCustomOptions,
  PrivateAppOptions,
  SagaEventHandler,
  ScanFileData,
  ViewEventHandler,
} from "../../types";
import {
  JOI_AGGREGATE_COMMAND_HANDLER_FILE,
  JOI_AGGREGATE_EVENT_HANDLER_FILE,
  JOI_SAGA_EVENT_HANDLER_FILE,
  JOI_VIEW_EVENT_HANDLER_FILE,
} from "../../schema";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../../handler";

export class EventSourceScanner {
  private readonly handlers: EventSourceHandlers;
  private readonly logger: ILogger;
  private readonly options: PrivateAppOptions;
  private readonly require: NodeJS.Require;

  public constructor(
    options: PrivateAppOptions,
    custom: AppCustomOptions,
    handlers: EventSourceHandlers,
    logger: ILogger,
  ) {
    this.handlers = handlers;
    this.logger = logger;
    this.options = options;
    this.require = custom.require || require;
  }

  public async scanFiles(): Promise<void> {
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

  public loadCommandHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command handler location");
    }

    const handlers = this.getFileHandlers<AggregateCommandHandler<unknown, unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate command handler", { handler: file.path });

      assertSchema(JOI_AGGREGATE_COMMAND_HANDLER_FILE.required().validate(handler));

      this.handlers.aggregateCommandHandlers.push(
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

  public loadEventHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<AggregateEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate event handler", { handler: file.path });

      assertSchema(JOI_AGGREGATE_EVENT_HANDLER_FILE.required().validate(handler));

      this.handlers.aggregateEventHandlers.push(
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

  public loadSagaHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<SagaEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found saga event handler", { handler: file.path });

      assertSchema(JOI_SAGA_EVENT_HANDLER_FILE.required().validate(handler));

      this.handlers.sagaEventHandlers.push(
        new SagaEventHandlerImplementation({
          eventName: snakeCase(file.name),
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.handlers.context(handler.aggregate?.context)),
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

  public loadViewHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<ViewEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found view event handler", { handler: file.path });

      assertSchema(JOI_VIEW_EVENT_HANDLER_FILE.required().validate(handler));

      this.handlers.viewEventHandlers.push(
        new ViewEventHandlerImplementation({
          eventName: snakeCase(file.name),
          adapters: handler.adapters,
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.handlers.context(handler.aggregate?.context)),
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

  public loadCommandAggregate(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command location");
    }

    const name = snakeCase(file.name);

    this.handlers.registerCommandAggregate(name, aggregate);
  }

  public loadEventAggregate(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event location");
    }

    const name = snakeCase(file.name);

    this.handlers.registerEventAggregate(name, aggregate);
  }

  // private

  private getFileHandlers<THandler>(path: string): Array<THandler> {
    const required = this.require(path);
    const handlers = required.default || required.main;

    if (!handlers) {
      throw new Error(`Expected methods [ default | main ] from [ ${path} ]`);
    }

    if (isArray(handlers)) {
      return handlers as Array<THandler>;
    }

    return [handlers as THandler];
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
}
