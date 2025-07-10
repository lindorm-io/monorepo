import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IRedisSource } from "@lindorm/redis";
import { Dict } from "@lindorm/types";
import { Predicated } from "@lindorm/utils";
import { IRedisViewRepository } from "../../interfaces";
import {
  HandlerIdentifier,
  RedisFindCriteria,
  ViewRepositoryAttributes,
  ViewStoreAttributes,
} from "../../types";
import { RedisBase } from "./RedisBase";

export class RedisViewRepository<S extends Dict = Dict>
  extends RedisBase
  implements IRedisViewRepository<S>
{
  private readonly view: HandlerIdentifier;

  public constructor(
    connection: IRedisSource,
    handlerIdentifier: HandlerIdentifier,
    logger: ILogger,
  ) {
    super(connection, logger);

    this.view = handlerIdentifier;
  }

  public async find(
    criteria: RedisFindCriteria<S> = {},
  ): Promise<Array<ViewRepositoryAttributes<S>>> {
    const keys = await this.scanKeys();
    if (!keys.length) return [];

    const data = await this.source.client.mget(...keys);

    const collection = data
      .map((item) => JsonKit.parse<ViewStoreAttributes>(item))
      .filter((item) => !item.destroyed);

    const filtered = Predicated.filter(collection, criteria);

    return filtered.map((x) => ({
      id: x.id,
      state: x.state,
      created_at: x.created_at,
      updated_at: x.updated_at,
    })) as Array<ViewRepositoryAttributes<S>>;
  }

  public async findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined> {
    const data = await this.source.client.get(this.redisKey(id));

    if (!data) return undefined;

    const parsed = JsonKit.parse<ViewStoreAttributes>(data);

    return {
      id: parsed.id,
      state: parsed.state,
      created_at: parsed.created_at,
      updated_at: parsed.updated_at,
    } as ViewRepositoryAttributes<S>;
  }

  public async findOne(
    criteria: RedisFindCriteria<S>,
  ): Promise<ViewRepositoryAttributes<S> | undefined> {
    const [data] = await this.find(criteria);
    return data;
  }

  // private

  private redisKey(id: string): string {
    return `view:${this.view.namespace}:${this.view.name}:${id}`;
  }

  private async scanKeys(): Promise<Array<string>> {
    const pattern = `view:${this.view.namespace}:${this.view.name}:*`;

    let cursor = "0";
    let keys: Array<string> = [];

    do {
      const reply = await this.source.client.scan(cursor, "MATCH", pattern, "COUNT", 100);

      cursor = reply[0];
      keys = keys.concat(reply[1]);
    } while (cursor !== "0");

    return keys;
  }
}
