import { IPostgresConnection } from "@lindorm-io/postgres";
import { ILogger } from "@lindorm-io/winston";
import { difference } from "lodash";

export abstract class PostgresBase {
  protected readonly connection: IPostgresConnection;
  protected readonly logger: ILogger;
  protected promise: () => Promise<void>;

  protected constructor(connection: IPostgresConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["PostgresBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // protected abstract

  protected abstract initialise(): Promise<void>;

  protected async tableExists(table: string): Promise<boolean> {
    const text = "SELECT is_insertable_into FROM information_schema.tables WHERE table_name = $1";
    const values = [table];
    const result = await this.connection.query(text, values);
    return result.rowCount === 1 && result.rows[0].is_insertable_into === "YES";
  }

  protected async indicesExist(table: string, expectedIndices: Array<string>): Promise<boolean> {
    const text = "SELECT indexname FROM pg_indexes WHERE tablename = $1";
    const values = [table];
    const result = await this.connection.query(text, values);
    const indices = result.rows.map((item) => item.indexname);
    const diff = difference(indices, expectedIndices);
    return !diff.length;
  }
}
