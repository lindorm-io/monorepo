import { ILogger } from "@lindorm/logger";
import { IPostgresQueryBuilder, IPostgresSource } from "@lindorm/postgres";
import { CHECKSUM_STORE, CHECKSUM_STORE_INDEXES } from "../../constants/private";
import { IChecksumStore } from "../../interfaces";
import { ChecksumStoreAttributes, ChecksumStoreFindFilter } from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_CHECKSUM_STORE } from "./sql/checksum-store";

export class PostgresChecksumStore extends PostgresBase implements IChecksumStore {
  private readonly qb: IPostgresQueryBuilder<ChecksumStoreAttributes>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.qb = source.queryBuilder<ChecksumStoreAttributes>(CHECKSUM_STORE);
  }

  // public

  public async find(
    filter: ChecksumStoreFindFilter,
  ): Promise<ChecksumStoreAttributes | undefined> {
    this.logger.debug("Finding checksum entity", { filter });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qb.select({
          id: filter.id,
          name: filter.name,
          context: filter.context,
          event_id: filter.event_id,
        }),
      );

      const item = PostgresChecksumStore.toChecksumEntity(result.rows);

      if (!item) {
        this.logger.debug("No checksum entity found");

        return undefined;
      }

      this.logger.debug("Found checksum entity", { item });

      return item;
    } catch (err: any) {
      this.logger.error("Failed to find checksum entity", err);

      throw err;
    }
  }

  public async insert(attributes: ChecksumStoreAttributes): Promise<void> {
    this.logger.debug("Inserting checksum entity", { attributes });

    try {
      await this.promise();

      await this.source.query(this.qb.insert(attributes));

      this.logger.debug("Inserted checksum entity", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert checksum entity", err);

      throw err;
    }
  }

  // private

  protected async initialise(): Promise<void> {
    await this.connect();

    const storeExists = await this.tableExists(CHECKSUM_STORE);
    if (!storeExists) {
      await this.source.query(CREATE_TABLE_CHECKSUM_STORE);
    }

    const missingIndexes = await this.getMissingIndexes<ChecksumStoreAttributes>(
      CHECKSUM_STORE,
      CHECKSUM_STORE_INDEXES,
    );
    await this.createIndexes(CHECKSUM_STORE, missingIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private static

  private static toChecksumEntity(
    rows: Array<ChecksumStoreAttributes>,
  ): ChecksumStoreAttributes | undefined {
    if (!rows.length) return undefined;

    if (rows.length > 1) {
      throw new Error("Multiple checksum entities found");
    }

    const [row] = rows;

    return row;
  }
}
