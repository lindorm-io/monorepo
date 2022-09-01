import { ILogger } from "@lindorm-io/winston";
import { LindormError } from "@lindorm-io/errors";
import {
  assertSchema,
  defaultAggregateCommandHandlerSchema,
  extractNameData,
  StructureScanner,
} from "../util";
import { flatten, isArray, snakeCase, uniq } from "lodash";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  QueryHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../handler";
import {
  JOI_AGGREGATE_COMMAND_HANDLER_FILE,
  JOI_AGGREGATE_EVENT_HANDLER_FILE,
  JOI_QUERY_HANDLER_FILE,
  JOI_SAGA_EVENT_HANDLER_FILE,
  JOI_VIEW_EVENT_HANDLER_FILE,
} from "../schema";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  EventSourceCustomOptions,
  IAggregateCommandHandler,
  IAggregateEventHandler,
  IQueryHandler,
  ISagaEventHandler,
  IViewEventHandler,
  EventSourcePrivateOptions,
  QueryHandler,
  SagaEventHandler,
  ScanFileData,
  ViewEventHandler,
} from "../types";

export class EventSourceScanner {
  private readonly logger: ILogger;
  private readonly options: EventSourcePrivateOptions;
  private readonly require: NodeJS.Require;

  public readonly aggregateCommandHandlers: Array<IAggregateCommandHandler>;
  public readonly aggregateEventHandlers: Array<IAggregateEventHandler>;
  public readonly queryHandlers: Array<IQueryHandler>;
  public readonly sagaEventHandlers: Array<ISagaEventHandler>;
  public readonly viewEventHandlers: Array<IViewEventHandler>;

  public readonly commandAggregates: Record<string, Array<string>>;

  public constructor(
    options: EventSourcePrivateOptions,
    custom: EventSourceCustomOptions,
    logger: ILogger,
  ) {
    this.logger = logger;
    this.options = options;
    this.require = custom.require || require;

    this.aggregateCommandHandlers = [];
    this.aggregateEventHandlers = [];
    this.queryHandlers = [];
    this.sagaEventHandlers = [];
    this.viewEventHandlers = [];

    this.commandAggregates = {};
  }

  // public scan

  public async scanAggregates(): Promise<void> {
    const scanner = new StructureScanner(this.options.aggregates, this.options.scanner.extensions);

    const files = scanner.scan();

    this.logger.debug("Scanning aggregates", { files });

    for (const file of files) {
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

  public async scanQueries(): Promise<void> {
    const scanner = new StructureScanner(this.options.queries, this.options.scanner.extensions);

    const files = scanner.scan();

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

  public registerCommandAggregate(name: string, aggregate: string): void {
    const snake = snakeCase(name);
    const current = this.commandAggregates[snake] || [];

    this.commandAggregates[snake] = uniq(flatten([current, aggregate]));
  }

  public getCommandAggregate(name: string): string {
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

  // private handler scanners

  private loadCommandHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command handler location");
    }

    const handlers = this.getFileHandlers<AggregateCommandHandler<unknown, unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate command handler", { handler: file.name });

      assertSchema(JOI_AGGREGATE_COMMAND_HANDLER_FILE.required().validate(handler));

      const { name: commandName } = extractNameData(handler.command.name);

      this.aggregateCommandHandlers.push(
        new AggregateCommandHandlerImplementation({
          commandName,
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

  private loadEventHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<AggregateEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found aggregate event handler", { handler: file.name });

      assertSchema(JOI_AGGREGATE_EVENT_HANDLER_FILE.required().validate(handler));

      const { name: eventName } = extractNameData(handler.event.name);

      this.aggregateEventHandlers.push(
        new AggregateEventHandlerImplementation({
          eventName,
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

  private loadQueryHandlers(file: ScanFileData): void {
    const handlers = this.getFileHandlers<QueryHandler<unknown, unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found query handler", { handler: file.name });

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
  }

  private loadSagaHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<SagaEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found saga event handler", { handler: file.name });

      assertSchema(JOI_SAGA_EVENT_HANDLER_FILE.required().validate(handler));

      const { name: eventName } = extractNameData(handler.event.name);

      this.sagaEventHandlers.push(
        new SagaEventHandlerImplementation({
          eventName,
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          saga: {
            name: snakeCase(handler.saga),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          version: handler.version,
          getSagaId: handler.getSagaId,
          handler: handler.handler,
        }),
      );
    }
  }

  private loadViewHandlers(file: ScanFileData): void {
    const [directory, aggregate] = file.parents;

    if (directory !== "events") {
      throw new Error("Invalid event handler location");
    }

    const handlers = this.getFileHandlers<ViewEventHandler<unknown>>(file.path);

    for (const handler of handlers) {
      this.logger.debug("Found view event handler", { handler: file.name });

      assertSchema(JOI_VIEW_EVENT_HANDLER_FILE.required().validate(handler));

      const { name: eventName } = extractNameData(handler.event.name);

      this.viewEventHandlers.push(
        new ViewEventHandlerImplementation({
          eventName,
          aggregate: {
            name: snakeCase(aggregate),
            context: isArray(handler.aggregate?.context)
              ? handler.aggregate.context.map((context) => snakeCase(context))
              : snakeCase(this.context(handler.aggregate?.context)),
          },
          view: {
            name: snakeCase(handler.view),
            context: snakeCase(this.options.context),
          },
          conditions: handler.conditions,
          options: handler.options,
          version: handler.version,
          getViewId: handler.getViewId,
          handler: handler.handler,
        }),
      );
    }
  }

  // private scanners

  private loadCommandAggregate(file: ScanFileData): void {
    const content = this.require(file.path);
    const commands = Object.keys(content);

    if (commands.length !== 1) {
      throw new Error(`Invalid amount of commands in file [ ${file.path} ]`);
    }

    const [command] = commands;
    const { name } = extractNameData(command);
    const [directory, aggregate] = file.parents;

    if (directory !== "commands") {
      throw new Error("Invalid command location");
    }

    this.registerCommandAggregate(name, aggregate);

    this.logger.debug("Found command aggregate", { name });
  }

  // private helpers

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
