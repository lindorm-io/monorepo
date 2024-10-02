import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { IScanData, IScanner, Scanner } from "@lindorm/scanner";
import { uniq } from "@lindorm/utils";
import { z } from "zod";
import {
  HermesAggregateCommandHandler,
  HermesAggregateEventHandler,
  HermesChecksumEventHandler,
  HermesErrorHandler,
  HermesQueryHandler,
  HermesSagaEventHandler,
  HermesViewEventHandler,
} from "../../handlers";
import {
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IErrorHandler,
  IHermesAggregateCommandHandler,
  IHermesAggregateEventHandler,
  IHermesChecksumEventHandler,
  IHermesErrorHandler,
  IHermesQueryHandler,
  IHermesSagaEventHandler,
  IHermesViewEventHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
} from "../../interfaces";
import {
  AggregateCommandHandlerSchema,
  AggregateEventHandlerSchema,
  ErrorHandlerSchema,
  QueryHandlerSchema,
  SagaEventHandlerSchema,
  ViewEventHandlerSchema,
} from "../../schemas";
import { GetAggregateEventData, HermesConfig } from "../../types";
import { extractNameData } from "../../utils/private";

export class HermesScanner {
  private readonly logger: ILogger;
  private readonly options: HermesConfig;
  private readonly scanner: IScanner;

  public readonly aggregateCommandHandlers: Array<IHermesAggregateCommandHandler>;
  public readonly aggregateEventHandlers: Array<IHermesAggregateEventHandler>;
  public readonly checksumEventHandlers: Array<IHermesChecksumEventHandler>;
  public readonly errorHandlers: Array<IHermesErrorHandler>;
  public readonly queryHandlers: Array<IHermesQueryHandler>;
  public readonly sagaEventHandlers: Array<IHermesSagaEventHandler>;
  public readonly viewEventHandlers: Array<IHermesViewEventHandler>;

  public readonly commandAggregates: Record<string, Array<string>>;
  public readonly eventAggregates: Record<string, Array<string>>;

  public constructor(options: HermesConfig, logger: ILogger) {
    this.logger = logger;
    this.options = options;
    this.scanner = new Scanner(options.scanner);

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
    const files = Scanner.flatten(scan);

    this.logger.debug("Scanning aggregates", { files });

    for (const file of files) {
      if (file.parents.length !== 3) {
        throw new Error(
          "Expecting file structure: [ . / aggregates / <aggregate-name> / {commands|events} / <file-name> . {command|event|handler} . {js|ts} ]",
        );
      }

      if (!this.isValid("aggregate", file.baseName)) continue;

      const [directory] = file.parents.reverse();

      switch (directory) {
        case "commands":
          await this.switchCommands(file);
          break;

        case "errors":
          await this.switchErrors(file);
          break;

        case "events":
          await this.switchEvents(file);
          break;

        default:
          break;
      }
    }
  }

  public async scanQueries(): Promise<void> {
    const directory = this.scanner.scan(this.options.directories.queries);

    this.logger.debug("Scanning queries", { files: directory.children });

    for (const file of directory.children) {
      switch (file.types[0]) {
        case "handler":
          await this.loadQueryHandlers(file);
          break;

        default:
          break;
      }
    }
  }

  public async scanSagas(): Promise<void> {
    const scan = this.scanner.scan(this.options.directories.sagas);
    const files = Scanner.flatten(scan);

    this.logger.debug("Scanning sagas", { files });

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting file structure: [ . / sagas / <saga-name> / <file-name> . {handler} . {js|ts} ]",
        );
      }

      await this.loadSagaHandlers(file);
    }
  }

  public async scanViews(): Promise<void> {
    const scan = this.scanner.scan(this.options.directories.views);
    const files = Scanner.flatten(scan);

    this.logger.debug("Scanning views", { files });

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "Expecting file structure: [ . / views / <view-name> / <file-name> . {handler} . {js|ts} ]",
        );
      }

      await this.loadViewHandlers(file);
    }
  }

  // public

  public context(context?: string): string {
    return context ?? this.options.context;
  }

  public registerAggregateCommand(name: string, aggregate: string): void {
    this.logger.debug("Registering aggregate command", { name, aggregate });

    const snake = snakeCase(name);
    const current = this.commandAggregates[snake] ?? [];

    this.commandAggregates[snake] = uniq([current, aggregate]).flat();
  }

  public registerAggregateEvent(name: string, aggregate: string): void {
    this.logger.debug("Registering aggregate event", { name, aggregate });

    const snake = snakeCase(name);
    const current = this.eventAggregates[snake] ?? [];

    this.eventAggregates[snake] = uniq([current, aggregate]).flat();
  }

  public getAggregateFromCommand(name: string): string {
    this.logger.debug("Getting aggregate from command", { name });

    const commandAggregates = this.commandAggregates[name];

    if (!commandAggregates.length) {
      throw new LindormError("Aggregate not registered to command", {
        data: { commandAggregates },
      });
    }

    if (commandAggregates.length > 1) {
      throw new LindormError("Multiple aggregates registered to command", {
        data: { commandAggregates },
      });
    }

    const [aggregateName] = commandAggregates;

    this.logger.debug("Found aggregate from command", { name, aggregateName });

    return aggregateName;
  }

  // private switch handlers

  private getAggregateFromEvent(name: string): string {
    this.logger.debug("Getting aggregate from event", { name });

    const eventAggregates = this.eventAggregates[name];

    if (!eventAggregates?.length) {
      throw new LindormError("Aggregate not registered to event", {
        data: { eventAggregates },
      });
    }

    if (eventAggregates.length > 1) {
      throw new LindormError("Multiple aggregates registered to event", {
        data: { eventAggregates },
      });
    }

    const [aggregateName] = eventAggregates;

    this.logger.debug("Found aggregate from event", { name, aggregateName });

    return aggregateName;
  }

  private async switchCommands(file: IScanData): Promise<void> {
    const [type] = file.types;

    switch (type) {
      case "command":
        return await this.loadAggregateCommand(file);

      case "handler":
        return await this.loadCommandHandlers(file);

      default:
        return;
    }
  }

  private async switchErrors(file: IScanData): Promise<void> {
    const [type] = file.types;

    switch (type) {
      case "handler":
        return await this.loadErrorHandlers(file);

      default:
        return;
    }
  }

  private async switchEvents(file: IScanData): Promise<void> {
    const [type] = file.types;

    switch (type) {
      case "event":
        await this.loadAggregateEvent(file);
        await this.loadChecksumEventHandler(file);
        return;

      case "handler":
        return await this.loadAggregateEventHandlers(file);

      default:
        return;
    }
  }

  // private handler scanners

  private async loadCommandHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading command handler", { file: file.fullPath });

    const [directory, aggregate] = file.parents.reverse();

    if (directory !== "commands") {
      throw new Error("Invalid command handler location");
    }

    const handlers = await this.getFileHandlers<IAggregateCommandHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(
        `Invalid amount of handlers exported from file [ ${file.fullPath} ]`,
      );
    }

    const [handler] = handlers;

    this.logger.debug("Found aggregate command handler", { handler: file.baseName });

    AggregateCommandHandlerSchema.parse(handler);

    const { name: commandName, version } = extractNameData(handler.command.name);

    this.aggregateCommandHandlers.push(
      new HermesAggregateCommandHandler({
        commandName,
        aggregate: {
          name: aggregate,
          context: this.options.context,
        },
        conditions: handler.conditions,
        encryption: handler.encryption,
        schema: handler.schema ? handler.schema : z.record(z.any()),
        version,
        handler: handler.handler,
      }),
    );

    this.logger.debug("Loaded aggregate command handler", { handler: file.baseName });
  }

  private async loadAggregateEventHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading aggregate event handler", { file: file.fullPath });

    const [directory, aggregate] = file.parents.reverse();

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = await this.getFileHandlers<IAggregateEventHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(
        `Invalid amount of handlers exported from file [ ${file.fullPath} ]`,
      );
    }

    const [handler] = handlers;

    this.logger.debug("Found aggregate event handler", { handler: file.baseName });

    AggregateEventHandlerSchema.parse(handler);

    const { name: eventName, version } = extractNameData(handler.event.name);

    this.aggregateEventHandlers.push(
      new HermesAggregateEventHandler({
        eventName,
        aggregate: {
          name: aggregate,
          context: this.options.context,
        },
        version,
        handler: handler.handler,
      }),
    );

    this.logger.debug("Loaded aggregate event handler", { handler: file.baseName });
  }

  private async loadChecksumEventHandler(file: IScanData): Promise<void> {
    this.logger.debug("Loading checksum event handler", { file: file.fullPath });

    const { eventName, aggregate } = await this.getAggregateEventData(file);

    this.checksumEventHandlers.push(
      new HermesChecksumEventHandler({ eventName, aggregate }),
    );

    this.logger.debug("Loaded checksum event handler", { handler: file.baseName });
  }

  private async loadErrorHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading error handler", { file: file.fullPath });

    const [directory, aggregate] = file.parents.reverse();

    if (directory !== "errors") {
      throw new Error("Invalid error handler location");
    }

    const handlers = await this.getFileHandlers<IErrorHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(
        `Invalid amount of handlers exported from file [ ${file.fullPath} ]`,
      );
    }

    const [handler] = handlers;

    this.logger.debug("Found error handler", { handler: file.baseName });

    ErrorHandlerSchema.parse(handler);

    this.errorHandlers.push(
      new HermesErrorHandler({
        errorName: handler.error.name,
        aggregate: {
          name: aggregate,
          context: Array.isArray(handler.aggregate?.context)
            ? handler.aggregate.context
            : this.context(handler.aggregate?.context),
        },
        handler: handler.handler,
      }),
    );

    this.logger.debug("Loaded error handler", { handler: file.baseName });
  }

  private async loadQueryHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading query handler", { file: file.fullPath });

    const handlers = await this.getFileHandlers<IQueryHandler>(file.fullPath);

    if (handlers.length !== 1) {
      throw new Error(
        `Invalid amount of handlers exported from file [ ${file.fullPath} ]`,
      );
    }

    const [handler] = handlers;

    this.logger.debug("Found query handler", { handler: file.baseName });

    QueryHandlerSchema.parse(handler);

    const { name: queryName } = extractNameData(handler.query.name);

    this.queryHandlers.push(
      new HermesQueryHandler({
        queryName,
        view: {
          name: handler.view,
          context: this.context(handler.context),
        },
        handler: handler.handler,
      }),
    );

    this.logger.debug("Loaded query handler", { handler: file.baseName });
  }

  private async loadSagaHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading saga handlers", { file: file.fullPath });

    const [sagaName] = file.parents.reverse();

    const handlers = await this.getFileHandlers<ISagaEventHandler>(file.fullPath);

    for (const handler of handlers) {
      this.logger.debug("Found saga event handler", { sagaName, handler: file.baseName });

      SagaEventHandlerSchema.parse(handler);

      const { name: eventName, version } = extractNameData(handler.event.name);

      this.sagaEventHandlers.push(
        new HermesSagaEventHandler({
          eventName,
          aggregate: {
            name: handler.aggregate?.name ?? this.getAggregateFromEvent(eventName),
            context: Array.isArray(handler.aggregate?.context)
              ? handler.aggregate.context
              : this.context(handler.aggregate?.context),
          },
          saga: {
            name: sagaName,
            context: this.options.context,
          },
          conditions: handler.conditions,
          version,
          getSagaId: handler.getSagaId,
          handler: handler.handler,
        }),
      );
    }

    this.logger.debug("Loaded saga handlers", { handler: file.baseName });
  }

  private async loadViewHandlers(file: IScanData): Promise<void> {
    this.logger.debug("Loading view handlers", { file: file.fullPath });

    const [viewName] = file.parents.reverse();

    const handlers = await this.getFileHandlers<IViewEventHandler>(file.fullPath);

    for (const handler of handlers) {
      this.logger.debug("Found view event handler", { viewName, handler: file.baseName });

      ViewEventHandlerSchema.parse(handler);

      const { name: eventName, version } = extractNameData(handler.event.name);

      this.viewEventHandlers.push(
        new HermesViewEventHandler({
          eventName,
          view: {
            name: viewName,
            context: this.options.context,
          },
          adapter: handler.adapter,
          aggregate: {
            name: handler.aggregate?.name ?? this.getAggregateFromEvent(eventName),
            context: Array.isArray(handler.aggregate?.context)
              ? handler.aggregate.context
              : this.context(handler.aggregate?.context),
          },
          conditions: handler.conditions,
          version,
          getViewId: handler.getViewId,
          handler: handler.handler,
        }),
      );
    }

    this.logger.debug("Loaded view handlers", { handler: file.baseName });
  }

  // private scanners

  private async loadAggregateCommand(file: IScanData): Promise<void> {
    this.logger.debug("Loading aggregate command", { file: file.fullPath });

    const content = await this.scanner.import<any>(file);
    const commands = Object.keys(content);

    if (commands.length !== 1) {
      throw new Error(`Invalid amount of commands in file [ ${file.fullPath} ]`);
    }

    const [command] = commands;
    const { name } = extractNameData(command);
    const [directory, aggregate] = file.parents.reverse();

    if (directory !== "commands") {
      throw new Error("Invalid command location");
    }

    this.registerAggregateCommand(name, aggregate);

    this.logger.debug("Found aggregate command", { name });
  }

  private async loadAggregateEvent(file: IScanData): Promise<void> {
    this.logger.debug("Loading aggregate event", { file: file.fullPath });

    const { eventName, aggregate } = await this.getAggregateEventData(file);

    this.registerAggregateEvent(eventName, aggregate.name);

    this.logger.debug("Found aggregate event", { eventName, aggregate });
  }

  // private helpers

  private async getAggregateEventData(file: IScanData): Promise<GetAggregateEventData> {
    this.logger.debug("Getting aggregate event data", { file: file.fullPath });

    const content = await this.scanner.import<any>(file);
    const events = Object.keys(content);

    if (events.length !== 1) {
      throw new Error(`Invalid amount of events in file [ ${file.fullPath} ]`);
    }

    const [event] = events;
    const { name: eventName } = extractNameData(event);
    const [directory, aggregateName] = file.parents.reverse();

    if (directory !== "events") {
      throw new Error("Invalid event location");
    }

    this.logger.debug("Found aggregate event data", { eventName, aggregateName });

    return {
      eventName,
      aggregate: {
        name: aggregateName,
        context: this.options.context,
      },
    };
  }

  private async getFileHandlers<T>(path: string): Promise<Array<T>> {
    this.logger.debug("Getting file handlers", { path });

    const required = await this.scanner.import<any>(path);
    const handlers = required.default ?? required.main;

    if (!handlers) {
      throw new Error(`Expected methods [ default | main ] from [ ${path} ]`);
    }

    if (Array.isArray(handlers)) {
      return handlers as Array<T>;
    }

    this.logger.debug("Returning file handlers", { handlers: [handlers] });

    return [handlers as T];
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
