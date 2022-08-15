import { ILogger } from "@lindorm-io/winston";
import { RedisBase } from "./RedisBase";
import { RedisIndex } from "./RedisIndex";
import { RedisViewStore } from "./RedisViewStore";
import { isMatch } from "lodash";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  HandlerIdentifier,
  IRedisRepository,
  RedisViewRepositoryOptions,
  RedisViewStoreAttributes,
  State,
  ViewRepositoryData,
} from "../../types";

export class RedisViewRepository<S = State> extends RedisBase implements IRedisRepository<S> {
  private readonly index: RedisIndex;
  private readonly view: HandlerIdentifier;

  public constructor(options: RedisViewRepositoryOptions, logger: ILogger) {
    super(options, logger);

    this.view = options.view;
    this.index = new RedisIndex(this.connection, this.logger);
  }

  public async find(
    filter?: Partial<ViewRepositoryData<S>>,
  ): Promise<Array<ViewRepositoryData<S>>> {
    await this.promise();

    this.logger.debug("Finding views", { filter });

    try {
      const index = await this.index.get(this.view);
      const array: Array<RedisViewStoreAttributes> = [];

      for (const id of index) {
        const result = await this.connection.client.get(this.getKey(id));

        if (!result) continue;

        const json = parseBlob<RedisViewStoreAttributes>(result);

        if (json.destroyed) continue;
        if (Object.keys(filter).length && !isMatch(json, filter)) continue;

        array.push(json);
      }

      this.logger.debug("Returning views", { array });

      return array.map((item) => ({
        id: item.id,
        name: item.name,
        context: item.context,
        revision: item.revision,
        state: item.state as S,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err) {
      this.logger.error("Failed to find views", err);

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<S>> {
    await this.promise();

    try {
      const result = await this.connection.client.get(this.getKey(id));

      if (!result) {
        this.logger.debug("View not found", { result });

        return null;
      }

      const json = parseBlob<RedisViewStoreAttributes>(result);

      if (json.destroyed) {
        this.logger.debug("View is destroyed", { json });

        return null;
      }

      this.logger.debug("View found", { json });

      return {
        id: json.id,
        name: json.name,
        context: json.context,
        revision: json.revision,
        state: json.state as S,
        created_at: json.created_at,
        updated_at: json.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async findOne(filter: Partial<ViewRepositoryData<S>>): Promise<ViewRepositoryData<S>> {
    if (filter.id) {
      return this.findById(filter.id);
    }
    return (await this.find(filter))[0];
  }

  private getKey(id: string): string {
    return RedisViewStore.getKey({ ...this.view, id });
  }
}
