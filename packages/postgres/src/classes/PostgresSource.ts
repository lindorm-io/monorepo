import { isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import {
  Pool,
  PoolClient,
  QueryConfig,
  QueryConfigValues,
  QueryResult,
  QueryResultRow,
} from "pg";
import { PostgresError } from "../errors";
import { IPostgresSource } from "../interfaces";
import { ClonePostgresSourceOptions, PostgresSourceOptions } from "../types";
import { FromClone } from "../types/private";

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

  public async query<R extends QueryResultRow = any, V = Array<any>>(
    queryTextOrConfig: string | QueryConfig<V>,
    values?: QueryConfigValues<V>,
  ): Promise<QueryResult<R>> {
    let client: PoolClient;

    try {
      client = await this.client.connect();

      const query = isString(queryTextOrConfig)
        ? this.trim(queryTextOrConfig)
        : isString(queryTextOrConfig.text)
          ? this.trim(queryTextOrConfig.text)
          : queryTextOrConfig;

      this.logger.debug("Query", { query, values });

      return await client.query<R, V>(query, values);
    } catch (error: any) {
      this.logger.error("Query failed", { error });
      throw new PostgresError("Query failed", { error });
    } finally {
      if (client!) client.release();
    }
  }

  // private

  private trim(query: string): string {
    return query
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(" ");
  }
}
