import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import { CHECKSUM_STORE, CHECKSUM_STORE_INDEXES } from "../../constants/private";
import { IChecksumStore } from "../../interfaces";
import { ChecksumStoreAttributes, ChecksumStoreFindFilter } from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_CHECKSUM_STORE } from "./sql/checksum-store";

export class PostgresChecksumStore extends PostgresBase implements IChecksumStore {
  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);
  }

  // public

  public async find(
    filter: ChecksumStoreFindFilter,
  ): Promise<ChecksumStoreAttributes | undefined> {
    this.logger.debug("Finding checksum entity", { filter });

    try {
      await this.promise();

      const text = `
        SELECT *
        FROM
          ${CHECKSUM_STORE}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3 AND
          event_id = $4
        LIMIT 1
      `;

      const values = [filter.id, filter.name, filter.context, filter.event_id];

      const result = await this.source.query<ChecksumStoreAttributes>(text, values);
      const entity = PostgresChecksumStore.toChecksumEntity(result.rows);

      if (!entity) {
        this.logger.debug("No checksum entity found");

        return undefined;
      }

      this.logger.debug("Found checksum entity", { entity });

      return entity;
    } catch (err: any) {
      this.logger.error("Failed to find checksum entity", err);

      throw err;
    }
  }

  public async insert(attributes: ChecksumStoreAttributes): Promise<void> {
    this.logger.debug("Inserting checksum entity", { attributes });

    try {
      await this.promise();

      const text = `
        INSERT INTO ${CHECKSUM_STORE} (
          id,
          name,
          context,
          event_id,
          checksum,
          timestamp
        ) VALUES ($1,$2,$3,$4,$5,$6)`;

      const values = [
        attributes.id,
        attributes.name,
        attributes.context,
        attributes.event_id,
        attributes.checksum,
        attributes.timestamp,
      ];

      await this.source.query(text, values);

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

    return {
      id: row.id,
      name: row.name,
      context: row.context,
      event_id: row.event_id,
      checksum: row.checksum,
      timestamp: row.timestamp,
    };
  }
}
