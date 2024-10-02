import { ILogger } from "@lindorm/logger";
import { IPostgresQueryBuilder, IPostgresSource } from "@lindorm/postgres";
import { ENCRYPTION_STORE, ENCRYPTION_STORE_INDEXES } from "../../constants/private";
import { IEncryptionStore } from "../../interfaces";
import { EncryptionStoreAttributes, EncryptionStoreFindFilter } from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_ENCRYPTION_STORE } from "./sql/encryption-store";

export class PostgresEncryptionStore extends PostgresBase implements IEncryptionStore {
  private readonly qb: IPostgresQueryBuilder<EncryptionStoreAttributes>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.qb = source.queryBuilder<EncryptionStoreAttributes>(ENCRYPTION_STORE);
  }

  // public

  public async find(
    filter: EncryptionStoreFindFilter,
  ): Promise<EncryptionStoreAttributes | undefined> {
    this.logger.debug("Finding encryption entity", { filter });

    try {
      await this.promise();

      const result = await this.source.query(this.qb.select(filter));

      const item = PostgresEncryptionStore.toAttributes(result.rows);

      if (!item) {
        this.logger.debug("No encryption entity found");

        return undefined;
      }

      this.logger.debug("Found encryption entity", { item });

      return item;
    } catch (err: any) {
      this.logger.error("Failed to find encryption entity", err);

      throw err;
    }
  }

  public async insert(attributes: EncryptionStoreAttributes): Promise<void> {
    this.logger.debug("Inserting encryption entity", { attributes });

    try {
      await this.promise();

      await this.source.query(this.qb.insert(attributes));

      this.logger.debug("Inserted encryption entity", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert encryption entity", err);

      throw err;
    }
  }

  // private

  protected async initialise(): Promise<void> {
    await this.connect();

    const storeExists = await this.tableExists(ENCRYPTION_STORE);
    if (!storeExists) {
      await this.source.query(CREATE_TABLE_ENCRYPTION_STORE);
    }

    const missingIndexes = await this.getMissingIndexes<EncryptionStoreAttributes>(
      ENCRYPTION_STORE,
      ENCRYPTION_STORE_INDEXES,
    );
    await this.createIndexes(ENCRYPTION_STORE, missingIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private static

  private static toAttributes(
    rows: Array<EncryptionStoreAttributes>,
  ): EncryptionStoreAttributes | undefined {
    if (!rows.length) return undefined;

    if (rows.length > 1) {
      throw new Error("Multiple encryption entities found");
    }

    const [row] = rows;

    return row;
  }
}
