import { snakeCase } from "@lindorm-io/case";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import clone from "clone";
import { HandlerNotRegisteredError } from "../error";
import { QueryHandlerImplementation } from "../handler";
import {
  MemoryViewRepository,
  MongoViewRepository,
  NoopMongoViewRepository,
  NoopPostgresViewRepository,
  PostgresViewRepository,
} from "../infrastructure";
import {
  DtoClass,
  IQueryDomain,
  IQueryHandler,
  QueryDomainOptions,
  QueryHandlerContext,
  State,
} from "../types";
import { assertSnakeCase } from "../util";

export class QueryDomain<TQuery extends DtoClass = DtoClass, TState extends State = State>
  implements IQueryDomain<TQuery, TState>
{
  private readonly logger: Logger;
  private readonly mongo: IMongoConnection | undefined;
  private readonly postgres: IPostgresConnection | undefined;
  private readonly queryHandlers: Array<IQueryHandler>;

  public constructor(options: QueryDomainOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["QueryDomain"]);

    this.mongo = options.mongo;
    this.postgres = options.postgres;

    this.queryHandlers = [];
  }

  public registerQueryHandler<T extends DtoClass = DtoClass>(
    queryHandler: QueryHandlerImplementation<T>,
  ): void {
    this.logger.debug("Registering query handler", {
      queryName: queryHandler.queryName,
      view: queryHandler.view,
    });

    if (!(queryHandler instanceof QueryHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "QueryHandlerImplementation",
          actual: typeof queryHandler,
        },
      });
    }

    const existingHandler = this.queryHandlers.some((x) => x.queryName === queryHandler.queryName);

    if (existingHandler) {
      throw new LindormError("Query handler already registered", {
        debug: {
          queryName: queryHandler.queryName,
        },
      });
    }

    assertSnakeCase(queryHandler.view.context);
    assertSnakeCase(queryHandler.view.name);
    assertSnakeCase(queryHandler.queryName);

    this.queryHandlers.push(queryHandler);

    this.logger.verbose("Registered query handler", {
      queryName: queryHandler.queryName,
      view: queryHandler.view,
    });
  }

  public async query<TResult>(query: TQuery): Promise<TResult> {
    this.logger.debug("Handling query", { query });

    try {
      const queryHandler = this.queryHandlers.find(
        (x) => x.queryName === snakeCase(query.constructor.name),
      );

      if (!(queryHandler instanceof QueryHandlerImplementation)) {
        throw new HandlerNotRegisteredError();
      }

      const ctx: QueryHandlerContext = {
        query: clone(query),
        logger: this.logger.createChildLogger(["QueryHandler"]),
        repositories: {
          memory: new MemoryViewRepository<TState>(queryHandler.view),
          mongo: this.mongo
            ? new MongoViewRepository<TState>(this.mongo, queryHandler.view, this.logger)
            : new NoopMongoViewRepository(),
          postgres: this.postgres
            ? new PostgresViewRepository<TState>(this.postgres, queryHandler.view, this.logger)
            : new NoopPostgresViewRepository(),
        },
      };

      return await queryHandler.handler(ctx);
    } catch (err: any) {
      this.logger.error("Failed to handle query", err);

      throw err;
    }
  }
}
