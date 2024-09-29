import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import { Dict } from "@lindorm/types";
import { IPostgresViewRepository } from "../../interfaces";
import {
  HandlerIdentifier,
  PostgresViewRepositoryFindFilter,
  PostgresViewRepositoryFindOneFilter,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresBase } from "./PostgresBase";

export class PostgresViewRepository<S extends Dict = Dict>
  extends PostgresBase
  implements IPostgresViewRepository<S>
{
  private readonly view: HandlerIdentifier;

  public constructor(
    source: IPostgresSource,
    handlerIdentifier: HandlerIdentifier,
    logger: ILogger,
  ) {
    super(source, logger);

    this.view = handlerIdentifier;
  }

  public async find(
    filter: PostgresViewRepositoryFindFilter = {},
  ): Promise<Array<ViewRepositoryData<S>>> {
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
        .replace(/state ->/gm, "state -> '__record__' ->")
        .replace(
          /state -> '__record__' -> '__record__' ->/gm,
          "state -> '__record__' ->",
        );

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
      const { rows } = await this.source.query<ViewStoreAttributes>(text, values);

      return rows.map((item) => ({
        id: item.id,
        state: JsonKit.parse(JSON.stringify(item.state)),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err: any) {
      this.logger.error("Failed to find views", err);

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<S> | undefined> {
    this.logger.debug("Finding view", { id });

    try {
      const filter: PostgresViewRepositoryFindOneFilter = {
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
    filter: PostgresViewRepositoryFindOneFilter,
  ): Promise<ViewRepositoryData<S> | undefined> {
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
    await this.connect();
  }
}
