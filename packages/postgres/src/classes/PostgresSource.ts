import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { Pool, PoolClient, QueryConfig, QueryConfigValues } from "pg";
import { PostgresError } from "../errors";
import { IPostgresQueryBuilder, IPostgresSource } from "../interfaces";
import {
  ClonePostgresSourceOptions,
  PostgresResult,
  PostgresSourceOptions,
} from "../types";
import { FromClone } from "../types/private";
import { parseQuery } from "../utils/private";
import { parseQueryResult } from "../utils/private/parse-query-result";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";

export class PostgresSource implements IPostgresSource {
  private readonly logger: ILogger;

  public readonly client: Pool;

  public constructor(options: PostgresSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: PostgresSourceOptions | FromClone) {
    this.logger = options.logger.child(["PostgresSource"]);

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.client = opts.client;
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

  public async setup(): Promise<void> {}

  public async query<R extends Dict = any, V = Array<any>>(
    queryTextOrConfig: string | QueryConfig<V>,
    values?: QueryConfigValues<V>,
  ): Promise<PostgresResult<R>> {
    let client: PoolClient;

    try {
      client = await this.client.connect();

      const query = parseQuery(queryTextOrConfig);

      this.logger.debug("Query", { query, values });

      const result = await client.query<R, V>(query, values);

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

  public queryBuilder<T extends Dict>(table: string): IPostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>({ table });
  }
}
