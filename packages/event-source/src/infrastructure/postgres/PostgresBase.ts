import { Attributes, StoreIndexes } from "../../types";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";

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

  // protected

  protected async createIndexes<TFields extends Attributes = Attributes>(
    name: string,
    indexes: StoreIndexes<TFields>,
  ): Promise<void> {
    if (!indexes.length) return;

    for (const index of indexes) {
      let text = index.unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
      text += ` ${index.name} ON ${name} (`;

      for (const field of index.fields) {
        text += `${field as string},`;
      }

      text = text.trim().slice(0, -1) + ")";

      await this.connection.query(text);
    }
  }

  protected async tableExists(table: string): Promise<boolean> {
    const text = "SELECT is_insertable_into FROM information_schema.tables WHERE table_name = $1";
    const values = [table];
    const result = await this.connection.query(text, values);
    return result.rowCount === 1 && result.rows[0].is_insertable_into === "YES";
  }

  protected async getMissingIndexes<TFields extends Attributes = Attributes>(
    table: string,
    expectedIndexes: StoreIndexes<TFields>,
  ): Promise<StoreIndexes<TFields>> {
    const text = "SELECT indexname FROM pg_indexes WHERE tablename = $1";
    const values = [table];

    const result = await this.connection.query(text, values);
    const existing = result.rows.map((item) => item.indexname);

    return expectedIndexes.filter((item) => !existing.includes(item.name));
  }
}
