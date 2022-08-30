import { HandlerNotRegisteredError } from "../error";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { LindormError } from "@lindorm-io/errors";
import { QueryHandlerImplementation } from "../handler";
import { assertSnakeCase } from "../util";
import { cloneDeep, find, snakeCase, some } from "lodash";
import {
  DtoClass,
  IQueryDomain,
  IQueryHandler,
  QueryDomainOptions,
  QueryHandlerContext,
  State,
} from "../types";
import {
  MemoryViewRepository,
  MongoViewRepository,
  PostgresViewRepository,
} from "../infrastructure";

export class QueryDomain<TQuery extends DtoClass = DtoClass, TState extends State = State>
  implements IQueryDomain<TQuery, TState>
{
  private readonly logger: ILogger;
  private readonly mongo: IMongoConnection;
  private readonly postgres: IPostgresConnection;
  private readonly queryHandlers: Array<IQueryHandler>;

  public constructor(options: QueryDomainOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["QueryDomain"]);

    this.mongo = options.mongo;
    this.postgres = options.postgres;

    this.queryHandlers = [];
  }

  public registerQueryHandler(queryHandler: QueryHandlerImplementation): void {
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

    const existingHandler = some(this.queryHandlers, {
      queryName: queryHandler.queryName,
    });

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
      const queryHandler = find(this.queryHandlers, {
        queryName: snakeCase(query.constructor.name),
      });

      if (!(queryHandler instanceof QueryHandlerImplementation)) {
        throw new HandlerNotRegisteredError();
      }

      const ctx: QueryHandlerContext = {
        query: cloneDeep(query),
        logger: this.logger.createChildLogger(["QueryHandler"]),
        repositories: {
          memory: new MemoryViewRepository<TState>(queryHandler.view),
          mongo: new MongoViewRepository<TState>(this.mongo, queryHandler.view, this.logger),
          postgres: new PostgresViewRepository<TState>(
            this.postgres,
            queryHandler.view,
            this.logger,
          ),
        },
      };

      return await queryHandler.handler(ctx);
    } catch (err) {
      this.logger.error("Failed to handle query", err);

      throw err;
    }
  }
}
