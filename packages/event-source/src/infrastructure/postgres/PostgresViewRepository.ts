import { Logger } from "@lindorm-io/core-logger";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  HandlerIdentifier,
  IPostgresRepository,
  PostgresFindFilter,
  PostgresFindOneFilter,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";
import { getViewStoreName } from "../../util";
import { PostgresBase } from "./PostgresBase";

export class PostgresViewRepository<TState = State>
  extends PostgresBase
  implements IPostgresRepository<TState>
{
  private readonly view: HandlerIdentifier;

  public constructor(
    connection: IPostgresConnection,
    handlerIdentifier: HandlerIdentifier,
    logger: Logger,
  ) {
    super(connection, logger);

    this.view = handlerIdentifier;
  }

  public async find(filter: PostgresFindFilter = {}): Promise<Array<ViewRepositoryData<TState>>> {
    this.logger.debug("Finding views", { filter });

    let text = `
      SELECT 
        id,
        state,
        created_at,
        updated_at
      FROM
        ${getViewStoreName(this.view)}
      WHERE
        destroyed = FALSE
      `;

    const values = [];

    if (filter.where?.text) {
      const replaced = filter.where.text
        .replace(/state ->/gm, "state -> 'json' ->")
        .replace(/state -> 'json' -> 'json' ->/gm, "state -> 'json' ->");

      text += ` AND ${replaced}`;
    }
    if (filter.where?.values) {
      for (const value of filter.where.values) {
        values.push(value);
      }
    }
    if (filter.limit) {
      text += ` LIMIT ${filter.limit}`;
    }
    if (filter.offset) {
      text += ` OFFSET ${filter.limit}`;
    }
    if (filter.orderBy) {
      text += ` ORDER BY `;
      for (const [key, value] of Object.entries(filter.orderBy)) {
        text += `${key} ${value},`;
      }
      text = text.trim().slice(0, -1);
    }

    this.logger.debug("Querying", { text, values });

    try {
      const { rows } = await this.connection.query<ViewStoreAttributes>(text, values);

      return rows.map((item) => ({
        id: item.id,
        state: parseBlob(item.state),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err: any) {
      this.logger.error("Failed to find views", err);

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState> | undefined> {
    this.logger.debug("Finding view", { id });

    try {
      const filter: PostgresFindOneFilter = {
        where: {
          text: `
            id = $1 AND
            name = $2 AND
            context = $3
          `,
          values: [id, this.view.name, this.view.context],
        },
      };

      const result = await this.find({
        ...filter,
        limit: 1,
      });

      if (!result.length) {
        this.logger.debug("View not found");
        return;
      }

      return result[0];
    } catch (err: any) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async findOne(
    filter: PostgresFindOneFilter,
  ): Promise<ViewRepositoryData<TState> | undefined> {
    this.logger.debug("Finding view", { filter });

    try {
      const result = await this.find({
        ...filter,
        limit: 1,
      });

      if (!result.length) {
        this.logger.debug("View not found");
        return;
      }

      return result[0];
    } catch (err: any) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    /* ignored */
  }
}
