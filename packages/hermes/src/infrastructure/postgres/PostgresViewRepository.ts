import { ILogger } from "@lindorm/logger";
import {
  Criteria,
  IPostgresQueryBuilder,
  IPostgresSource,
  SelectOptions,
} from "@lindorm/postgres";
import { Dict } from "@lindorm/types";
import { IPostgresViewRepository } from "../../interfaces";
import {
  HandlerIdentifier,
  PostgresFindCriteria,
  PostgresFindOptions,
  ViewRepositoryAttributes,
  ViewStoreAttributes,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresBase } from "./PostgresBase";

export class PostgresViewRepository<S extends Dict = Dict>
  extends PostgresBase
  implements IPostgresViewRepository<S>
{
  private readonly view: HandlerIdentifier;
  private readonly queryBuilder: IPostgresQueryBuilder<ViewStoreAttributes>;

  public constructor(
    source: IPostgresSource,
    handlerIdentifier: HandlerIdentifier,
    logger: ILogger,
  ) {
    super(source, logger);

    this.view = handlerIdentifier;
    this.queryBuilder = this.source.queryBuilder<ViewStoreAttributes>(
      getViewStoreName(this.view),
    );
  }

  public async find(
    criteria: PostgresFindCriteria<S> = {},
    options: PostgresFindOptions<S> = {},
  ): Promise<Array<ViewRepositoryAttributes<S>>> {
    this.logger.debug("Finding views", { criteria });

    const selectCriteria: Criteria<ViewStoreAttributes> = {
      destroyed: false,
      ...criteria,
      state: criteria.state ? { __record__: criteria.state } : criteria.state,
    };

    const selectOptions: SelectOptions<ViewStoreAttributes> = {
      ...(options as Dict),
      columns: ["id", "state", "created_at", "updated_at"],
    };

    try {
      const { rows } = await this.source.query<ViewStoreAttributes>(
        this.queryBuilder.select(selectCriteria, selectOptions),
      );

      return rows.map((item) => ({
        id: item.id,
        state: item.state as S,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err: any) {
      this.logger.error("Failed to find views", err);
      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined> {
    return await this.findOne({ id });
  }

  public async findOne(
    criteria: PostgresFindCriteria<S>,
    options: PostgresFindOptions<S> = {},
  ): Promise<ViewRepositoryAttributes<S> | undefined> {
    const [result] = await this.find(criteria, options);
    return result;
  }

  // protected

  protected async initialise(): Promise<void> {
    await this.connect();
  }
}
