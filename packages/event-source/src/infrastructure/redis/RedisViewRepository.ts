import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection } from "@lindorm-io/redis";
import { parseBlob } from "@lindorm-io/string-blob";
import { filter } from "lodash";
import {
  HandlerIdentifier,
  IRedisRepository,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";
import { RedisBase } from "./RedisBase";

export class RedisViewRepository<TState extends State = State>
  extends RedisBase
  implements IRedisRepository<TState>
{
  private readonly view: HandlerIdentifier;

  public constructor(
    connection: IRedisConnection,
    handlerIdentifier: HandlerIdentifier,
    logger: Logger,
  ) {
    super(connection, logger);

    this.view = handlerIdentifier;
  }

  public async find(
    findFilter?: Partial<ViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<TState>>> {
    const keys = await this.scanKeys();
    const data = await this.connection.client.mget(...keys);

    const collection = data
      .map((item) => parseBlob<ViewStoreAttributes>(item))
      .filter((item) => !item.destroyed);

    const filtered = filter(collection, findFilter);

    return filtered.map((x) => ({
      id: x.id,
      state: x.state,
      created_at: x.created_at,
      updated_at: x.updated_at,
    })) as Array<ViewRepositoryData<TState>>;
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState> | undefined> {
    const data = await this.connection.client.get(this.redisKey(id));

    if (!data) return undefined;

    const parsed = parseBlob<ViewStoreAttributes>(data);

    return {
      id: parsed.id,
      state: parsed.state,
      created_at: parsed.created_at,
      updated_at: parsed.updated_at,
    } as ViewRepositoryData<TState>;
  }

  public async findOne(
    findFilter?: Partial<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<TState> | undefined> {
    const [data] = await this.find(findFilter);
    return data ?? undefined;
  }

  // private

  private redisKey(id: string): string {
    return `view:${this.view.context}:${this.view.name}:${id}`;
  }

  private async scanKeys(): Promise<Array<string>> {
    const pattern = `view:${this.view.context}:${this.view.name}:*`;

    let cursor = "0";
    let keys: Array<string> = [];

    do {
      const reply = await this.connection.client.scan(cursor, "MATCH", pattern, "COUNT", 100);

      cursor = reply[0];
      keys = keys.concat(reply[1]);
    } while (cursor !== "0");

    return keys;
  }
}
