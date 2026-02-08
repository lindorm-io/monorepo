import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { Pool, PoolClient, QueryConfig, QueryConfigValues } from "pg";
import { PostgresError } from "../errors";
import { IPostgresQueryBuilder, IPostgresSource } from "../interfaces";
import {
  ClonePostgresSourceOptions,
  PostgresResult,
  PostgresSourceOptions,
  PostgresSourceQueryBuilderOptions,
} from "../types";
import { FromClone } from "../types/private";
import { parseQuery, parseQueryResult } from "../utils/private";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";

export class PostgresSource implements IPostgresSource {
  public readonly __instanceof = "PostgresSource";

  private readonly logger: ILogger;

  public readonly client: Pool;

  public constructor(options: PostgresSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: PostgresSourceOptions | FromClone) {
    this.logger = options.logger.child(["PostgresSource"]);

    if ("_mode" in options && options._mode === "from_clone") {
      this.client = options.client;
    } else {
      const opts = options as PostgresSourceOptions;

      this.client = opts.config
        ? new Pool(opts.config)
        : new Pool({ connectionString: opts.url });
    }
  }

  // public

  public clone(options: ClonePostgresSourceOptions = {}): IPostgresSource {
    return new PostgresSource({
      _mode: "from_clone",
      client: this.client,
      logger: options.logger ?? this.logger,
    });
  }

  public async connect(): Promise<void> {}

  public async disconnect(): Promise<void> {
    await this.client.end();
  }

  public async ping(): Promise<void> {
    try {
      const client = await this.client.connect();
      try {
        await client.query("SELECT 1");
      } finally {
        client.release();
      }
      this.logger.debug("Ping successful");
    } catch (error: any) {
      throw new PostgresError("Ping failed", { error });
    }
  }

  public async setup(): Promise<void> {}

  public async query<R extends Dict = any, V = Array<any>>(
    queryTextOrConfig: string | QueryConfig<V>,
    values?: QueryConfigValues<V>,
  ): Promise<PostgresResult<R>> {
    let client: PoolClient;

    try {
      client = await this.client.connect();

      const query = parseQuery(queryTextOrConfig, values);

      this.logger.debug("Query", { query, values });

      const result = await client.query<R, V>(query);

      this.logger.debug("Result", {
        command: result.command,
        fields: result.fields,
        oid: result.oid,
        rowCount: result.rowCount,
        rows: result.rows,
      });

      return parseQueryResult(result);
    } catch (error: any) {
      this.logger.warn("Query failed", { error });
      throw new PostgresError("Query failed", { error });
    } finally {
      if (client!) client.release();
    }
  }

  public queryBuilder<T extends Dict>(
    table: string,
    options: PostgresSourceQueryBuilderOptions = {},
  ): IPostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>({
      table,
      stringifyComplexTypes: options.stringifyComplexTypes ?? true,
    });
  }
}
