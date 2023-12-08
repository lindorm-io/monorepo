import { snakeCase } from "@lindorm-io/case";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { ScanData, StructureScanner } from "@lindorm-io/structure-scanner";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  ChecksumEventHandlerImplementation,
  ErrorHandlerImplementation,
  QueryHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../handler";
import {
  JOI_AGGREGATE_COMMAND_HANDLER_FILE,
  JOI_AGGREGATE_EVENT_HANDLER_FILE,
  JOI_ERROR_HANDLER_FILE,
  JOI_QUERY_HANDLER_FILE,
  JOI_SAGA_EVENT_HANDLER_FILE,
  JOI_VIEW_EVENT_HANDLER_FILE,
} from "../schema";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  ErrorHandler,
  EventSourcePrivateOptions,
  GetAggregateEventData,
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IChecksumEventHandler,
  IErrorHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
  QueryHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../types";
import { assertSchema, defaultAggregateCommandHandlerSchema, extractNameData } from "../util";

export class EventSourceScanner {
  private readonly logger: Logger;
  private readonly options: EventSourcePrivateOptions;
  private readonly require: NodeJS.Require;
  private readonly scanner: StructureScanner;

  public readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  public readonly aggregateEventHandlers: Array<IAggregateEventHandler>;
  public readonly checksumEventHandlers: Array<IChecksumEventHandler>;
  public readonly errorHandlers: Array<IErrorHandler>;
  public readonly queryHandlers: Array<IQueryHandler>;
  public readonly sagaEventHandlers: Array<ISagaEventHandler>;
  public readonly viewEventHandlers: Array<IViewEventHandler>;

  public readonly commandAggregates: Record<string, Array<string>>;
  public readonly eventAggregates: Record<string, Array<string>>;

  public constructor(options: EventSourcePrivateOptions, logger: Logger) {
    this.logger = logger;
    this.options = options;
    this.require = options.require;
    this.scanner = new StructureScanner({ ...options.scanner, parentDirection: "reverse" });

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.checksumEventHandlers = [];
    this.errorHandlers = [];
    this.queryHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

    this.commandAggregates = {};
    this.eventAggregates = {};
  }

  // public scan

  public async scanAggregates(): Promise<void> {
    const scan = this.scanner.scan(this.options.directories.aggregates);
    const files = StructureScanner.flatten(scan);

    this.logger.debug("Scanning aggregates", { files });

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting file structure: [ . / aggregates / <aggregate-name> / {commands|events} / <file-name> . {command|event|handler} . {js|ts} ]",
        );
      }

      if (!this.isValid("aggregate", file.baseName)) continue;

      const [directory] = file.parents;

      switch (directory) {
        case "commands":
          this.switchCommands(file);
          break;

        case "errors":
          this.switchErrors(file);
          break;

        case "events":
          this.switchEvents(file);
          break;

        default:
          break;
      }
    }
  }

  public async scanSagas(): Promise<void> {
    const scan = this.scanner.scan(this.options.directories.sagas);
    const files = StructureScanner.flatten(scan);

    this.logger.debug("Scanning sagas", { files });

    for (const file of files) {
      if (file.parents.length !== 1) {
        throw new Error(
          "Expecting file structure: [ . / sagas / <saga-name> / <file-name> . {handler} . {js|ts} ]",
        );
      }

      this.loadSagaHandlers(file);
    }
  }

  public async scanViews(): Promise<void> {
    const scan = this.scanner.scan(this.options.directories.views);
    const files = StructureScanner.flatten(scan);

    this.logger.debug("Scanning views", { files });

    for (const file of files) {
      if (file.parents.length !== 1) {
        throw new Error(
          "Expecting file structure: [ . / views / <view-name> / <file-name> . {handler} . {js|ts} ]",
        );
      }

      this.loadViewHandlers(file);
    }
  }

  public async scanQueries(): Promise<void> {
    const files = this.scanner.scan(this.options.directories.queries);

    this.logger.debug("Scanning queries", { files });

    for (const file of files) {
      switch (file.type) {
        case "handler":
          this.loadQueryHandlers(file);
          break;

        case "query":
          break;

        default:
          break;
      }
    }
  }

  // public

  public context(context?: string): string {
    return context || this.options.context;
  }

  public registerAggregateCommand(name: string, aggregate: string): void {
    const snake = snakeCase(name);
    const current = this.commandAggregates[snake] || [];

    this.commandAggregates[snake] = [...new Set([current, aggregate].flat())];
  }

  public registerAggregateEvent(name: string, aggregate: string): void {
    const snake = snakeCase(name);
    const current = this.eventAggregates[snake] || [];

    this.eventAggregates[snake] = [...new Set([current, aggregate].flat())];
  }

  public getAggregateFromCommand(name: string): string {
    const commandAggregates = this.commandAggregates[name];

    if (!commandAggregates.length) {
      throw new LindormError("Invalid Command", {
        data: { commandAggregates },
        description: "Aggregate not registered to command",
      });
    }

    if (commandAggregates.length > 1) {
      throw new LindormError("Invalid Command", {
        data: { commandAggregates },
        description:
          "Multiple aggregates registered to command. You need to specify which aggregate to use in options",
      });
    }

    const [aggregateName] = commandAggregates;

    return aggregateName;
  }

  // private switch handlers

  private getAggregateFromEvent(name: string): string {
    const eventAggregates = this.eventAggregates[name];

    if (!eventAggregates.length) {
      throw new LindormError("Invalid Event", {
        data: { eventAggregates },
        description: "Aggregate not registered to event",
      });
    }

    if (eventAggregates.length > 1) {
      throw new LindormError("Invalid Event", {
        data: { eventAggregates },
        description:
          "Multiple aggregates registered to event. You need to specify which aggregate to use in options",
      });
    }

    const [aggregateName] = eventAggregates;

    return aggregateName;
  }

  private switchCommands(file: ScanData): void {
    switch (file.type) {
      case "command":
        return this.loadAggregateCommand(file);

      case "handler":
        return this.loadCommandHandlers(file);

      default:
        return;
    }
  }

  private switchErrors(file: ScanData): void {
    switch (file.type) {
      case "handler":
        return this.loadErrorHandlers(file);

      default:
        return;
    }
  }

  private switchEvents(file: ScanData): void {
    switch (file.type) {
      case "event":
        this.loadAggregateEvent(file);
        this.loadChecksumEventHandler(file);
        return;

      case "handler":
        return this.loadAggregateEventHandlers(file);

      default:
        return;
    }
  }

  // private handler scanners

  private loadCommandHandlers(file: ScanData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command handler location");
    }

    const handlers = this.getFileHandlers<AggregateCommandHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(`Invalid amount of handlers exported from file [ ${file.fullPath} ]`);
    }

    const [handler] = handlers;

    this.logger.debug("Found aggregate command handler", { handler: file.baseName });

    assertSchema(JOI_AGGREGATE_COMMAND_HANDLER_FILE.required().validate(handler));

    const { name: commandName, version } = extractNameData(handler.command.name);

    this.aggregateCommandHandlers.push(
      new AggregateCommandHandlerImplementation({
        commandName,
        aggregate: {
          name: snakeCase(aggregate),
          context: snakeCase(this.options.context),
        },
        conditions: handler.conditions,
        schema: handler.schema ? handler.schema : defaultAggregateCommandHandlerSchema,
        version,
        handler: handler.handler,
      }),
    );
  }

  private loadAggregateEventHandlers(file: ScanData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<AggregateEventHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(`Invalid amount of handlers exported from file [ ${file.fullPath} ]`);
    }

    const [handler] = handlers;

    this.logger.debug("Found aggregate event handler", { handler: file.baseName });

    assertSchema(JOI_AGGREGATE_EVENT_HANDLER_FILE.required().validate(handler));

    const { name: eventName, version } = extractNameData(handler.event.name);

    this.aggregateEventHandlers.push(
      new AggregateEventHandlerImplementation({
        eventName,
        aggregate: {
          name: snakeCase(aggregate),
          context: snakeCase(this.options.context),
        },
        version,
        handler: handler.handler,
      }),
    );
  }

  private loadChecksumEventHandler(file: ScanData): void {
    const { eventName, aggregate } = this.getAggregateEventData(file);

    this.checksumEventHandlers.push(
      new ChecksumEventHandlerImplementation({ eventName, aggregate }),
    );
  }

  private loadErrorHandlers(file: ScanData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "errors") {
      throw new Error("Invalid error handler location");
    }

    const handlers = this.getFileHandlers<ErrorHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(`Invalid amount of handlers exported from file [ ${file.fullPath} ]`);
    }

    const [handler] = handlers;

    this.logger.debug("Found error handler", { handler: file.baseName });

    assertSchema(JOI_ERROR_HANDLER_FILE.required().validate(handler));

    this.errorHandlers.push(
      new ErrorHandlerImplementation({
        errorName: snakeCase(handler.error.name),
        aggregate: {
          name: snakeCase(aggregate),
          context: Array.isArray(handler.aggregate?.context)
            ? handler.aggregate!.context.map((context) => snakeCase(context))
            : snakeCase(this.context(handler.aggregate?.context)),
        },
        handler: handler.handler,
      }),
    );
  }

  private loadQueryHandlers(file: ScanData): void {
    const handlers = this.getFileHandlers<QueryHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(`Invalid amount of handlers exported from file [ ${file.fullPath} ]`);
    }

    const [handler] = handlers;

    this.logger.debug("Found query handler", { handler: file.baseName });

    assertSchema(JOI_QUERY_HANDLER_FILE.required().validate(handler));

    const { name: queryName } = extractNameData(handler.query.name);

    this.queryHandlers.push(
      new QueryHandlerImplementation({
        queryName,
        view: {
          name: handler.view,
          context: this.context(handler.context),
        },
        handler: handler.handler,
      }),
    );
  }

  private loadSagaHandlers(file: ScanData): void {
    const [sagaName] = file.parents;

    const handlers = this.getFileHandlers<SagaEventHandler>(file.fullPath);

    for (const handler of handlers) {
      this.logger.debug("Found saga event handler", { sagaName, handler: file.baseName });

      assertSchema(JOI_SAGA_EVENT_HANDLER_FILE.required().validate(handler));

      const { name: eventName, version } = extractNameData(handler.event.name);

      this.sagaEventHandlers.push(
        new SagaEventHandlerImplementation({
          eventName,
          aggregate: {
            name: handler.aggregate?.name || this.getAggregateFromEvent(eventName),
            context: Array.isArray(handler.aggregate?.context)
              ? handler.aggregate!.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          saga: {
            name: snakeCase(sagaName),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          version,
          getSagaId: handler.getSagaId,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadViewHandlers(file: ScanData): void {
    const [viewName] = file.parents;

    const handlers = this.getFileHandlers<ViewEventHandler>(file.fullPath);

    for (const handler of handlers) {
      this.logger.debug("Found view event handler", { viewName, handler: file.baseName });

      assertSchema(JOI_VIEW_EVENT_HANDLER_FILE.required().validate(handler));

      const { name: eventName, version } = extractNameData(handler.event.name);

      this.viewEventHandlers.push(
        new ViewEventHandlerImplementation({
          eventName,
          view: {
            name: snakeCase(viewName),
            context: snakeCase(this.options.context),
          },
          adapter: handler.adapter,
          aggregate: {
            name: handler.aggregate?.name || this.getAggregateFromEvent(eventName),
            context: Array.isArray(handler.aggregate?.context)
              ? handler.aggregate!.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          conditions: handler.conditions,
          version,
          getViewId: handler.getViewId,
          handler: handler.handler,
        }),
      );
    }
  }

  // private scanners

  private loadAggregateCommand(file: ScanData): void {
    const content = this.require(file.fullPath);
    const commands = Object.keys(content);

    if (commands.length !== 1) {
      throw new Error(`Invalid amount of commands in file [ ${file.fullPath} ]`);
    }

    const [command] = commands;
    const { name } = extractNameData(command);
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command location");
    }

    this.registerAggregateCommand(name, aggregate);

    this.logger.debug("Found aggregate command", { name });
  }

  private loadAggregateEvent(file: ScanData): void {
    const { eventName, aggregate } = this.getAggregateEventData(file);

    this.registerAggregateEvent(eventName, aggregate.name);

    this.logger.debug("Found aggregate event", { name });
  }

  // private helpers

  private getAggregateEventData(file: ScanData): GetAggregateEventData {
    const content = this.require(file.fullPath);
    const events = Object.keys(content);

    if (events.length !== 1) {
      throw new Error(`Invalid amount of events in file [ ${file.fullPath} ]`);
    }

    const [event] = events;
    const { name: eventName } = extractNameData(event);
    const [directory, aggregateName] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event location");
    }

    return {
      eventName,
      aggregate: {
        name: snakeCase(aggregateName),
        context: snakeCase(this.options.context),
      },
    };
  }

  private getFileHandlers<THandler>(path: string): Array<THandler> {
    const required = this.require(path);
    const handlers = required.default || required.main;

    if (!handlers) {
      throw new Error(`Expected methods [ default | main ] from [ ${path} ]`);
    }

    if (Array.isArray(handlers)) {
      return handlers as Array<THandler>;
    }

    return [handlers as THandler];
  }

  private isValid(type: string, name: string): boolean {
    for (const regExp of this.options.fileFilter.include) {
      if (!regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is not included in domain`);
        return false;
      }
    }

    for (const regExp of this.options.fileFilter.exclude) {
      if (regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is excluded in domain`);
        return false;
      }
    }

    return true;
  }
}
