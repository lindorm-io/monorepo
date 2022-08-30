import {
  HandlerIdentifier,
  IPostgresRepository,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { getViewStoreName } from "../../util";
import { parseBlob } from "@lindorm-io/string-blob";

export class PostgresViewRepository<TState = State>
  extends PostgresBase
  implements IPostgresRepository<TState>
{
  private readonly view: HandlerIdentifier;

  public constructor(connection: IPostgresConnection, view: HandlerIdentifier, logger: ILogger) {
    super(connection, logger);

    this.view = view;
  }

  public async find(filter: any): Promise<Array<ViewRepositoryData<TState>>> {
    this.logger.debug("Finding views", { filter });

    throw new Error("Implementation missing");

    try {
      /* TODO: Implement */
    } catch (err) {
      this.logger.error("Failed to find views", err);
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState>> {
    this.logger.debug("Finding view", { id });

    try {
      const text = `
        SELECT *
        FROM
          ${getViewStoreName(this.view)}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3 AND
          destroyed != $4
        LIMIT 1
      `;

      const values = [id, this.view.name, this.view.context, true];

      const result = await this.connection.query<ViewStoreAttributes>(text, values);

      if (!result.rows.length) {
        this.logger.debug("View not found");

        return;
      }

      this.logger.debug("Found view", { result });

      const [data] = result.rows;

      return {
        id: data.id,
        name: data.name,
        context: data.context,
        revision: data.revision,
        state: parseBlob(data.state),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }

  public async findOne(filter: any): Promise<ViewRepositoryData<TState>> {
    this.logger.debug("Finding view", { filter });

    throw new Error("Implementation missing");

    try {
      /* TODO: Implement */
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    /* ignored */
  }
}
