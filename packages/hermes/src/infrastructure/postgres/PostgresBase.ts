import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import { Dict } from "@lindorm/types";
import { StoreIndexes } from "../../types";

export abstract class PostgresBase {
  protected readonly source: IPostgresSource;
  protected readonly logger: ILogger;
  protected promise: () => Promise<void>;

  protected constructor(source: IPostgresSource, logger: ILogger) {
    this.source = source;
    this.logger = logger.child(["PostgresBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // protected abstract

  protected abstract initialise(): Promise<void>;

  // protected

  protected async connect(): Promise<void> {
    await this.source.connect();
  }

  protected async createIndexes<F extends Dict = Dict>(
    name: string,
    indexes: StoreIndexes<F>,
  ): Promise<void> {
    if (!indexes.length) return;

    for (const index of indexes) {
      let text = index.unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
      text += ` ${index.name} ON ${name} (`;

      for (const field of index.fields) {
        text += `${field as string},`;
      }

      text = text.trim().slice(0, -1) + ")";

      await this.source.query(text);
    }
  }

  protected async tableExists(table: string): Promise<boolean> {
    const text =
      "SELECT is_insertable_into FROM information_schema.tables WHERE table_name = $1";
    const values = [table];
    const result = await this.source.query(text, values);
    return result.rowCount === 1 && result.rows[0].is_insertable_into === "YES";
  }

  protected async getMissingIndexes<F extends Dict = Dict>(
    table: string,
    expectedIndexes: StoreIndexes<F>,
  ): Promise<StoreIndexes<F>> {
    const text = "SELECT indexname FROM pg_indexes WHERE tablename = $1";
    const values = [table];

    const result = await this.source.query(text, values);
    const existing = result.rows.map((item) => item.indexname);

    return expectedIndexes.filter((item) => !existing.includes(item.name));
  }
}
