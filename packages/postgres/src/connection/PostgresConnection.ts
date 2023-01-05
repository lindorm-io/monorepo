import { ConnectionBase } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/core-logger";
import { IPostgresConnection, PostgresConnectionOptions } from "../types";
import { Pool, PoolConfig, QueryConfig, QueryResult, QueryResultRow } from "pg";

export class PostgresConnection
  extends ConnectionBase<Pool, PoolConfig>
  implements IPostgresConnection
{
  private readonly custom: typeof Pool;

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

    this.logger.debug("Query", { query: queryTextOrConfig, values });

    try {
      return await client.query(queryTextOrConfig, values);
    } finally {
      client.release();
    }
  }
}
