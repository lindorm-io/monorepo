import { ConnectionBase } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/core-logger";
import { Pool, PoolConfig, QueryConfig, QueryResult, QueryResultRow } from "pg";
import { IPostgresConnection, PostgresConnectionOptions } from "../types";

export class PostgresConnection
  extends ConnectionBase<Pool, PoolConfig>
  implements IPostgresConnection
{
  private readonly custom: typeof Pool | undefined;

  public constructor(options: PostgresConnectionOptions, logger: Logger) {
    const {
      connectInterval,
      connectTimeout,
      custom,
      host = "localhost",
      port = 5432,
      ...connectOptions
    } = options;

    super(
      {
        connectInterval,
        connectTimeout,
        connectOptions: {
          host,
          port,
          min: 1,
          max: 5,
          ...connectOptions,
        },
        type: "postgres",
      },
      logger,
    );

    this.custom = custom;
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Pool> {
    if (this.custom) {
      return new this.custom(this.connectOptions);
    }
    return new Pool(this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    /* ignored */
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.end();
  }

  // public

  public async query<
    TResult extends QueryResultRow = QueryResultRow,
    TValues extends Array<any> = Array<any>,
  >(
    queryTextOrConfig: QueryConfig<TValues> | string,
    values?: TValues,
  ): Promise<QueryResult<TResult>> {
    const client = await this.client.connect();

    const query =
      typeof queryTextOrConfig === "string"
        ? this.trim(queryTextOrConfig)
        : queryTextOrConfig.text
        ? this.trim(queryTextOrConfig.text)
        : queryTextOrConfig;

    this.logger.debug("Query", { query, values });

    try {
      return await client.query(query, values);
    } finally {
      client.release();
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
