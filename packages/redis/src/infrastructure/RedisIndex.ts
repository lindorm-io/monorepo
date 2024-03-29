import { IRedisConnection, IRedisIndex, RedisDocument, RedisIndexOptions } from "../types";
import { Logger } from "@lindorm-io/core-logger";
import { RedisIndexError } from "../errors";
import { snakeCase } from "@lindorm-io/case";

export class RedisIndex<Document extends RedisDocument> implements IRedisIndex {
  private readonly connection: IRedisConnection;
  private readonly logger: Logger;
  private readonly prefix: string;

  public readonly indexKey: keyof Document;

  public constructor(
    connection: IRedisConnection,
    logger: Logger,
    options: RedisIndexOptions<Document>,
  ) {
    this.connection = connection;
    this.indexKey = options.indexKey;
    this.prefix = snakeCase(options.prefix);

    this.logger = logger.createChildLogger(["RedisCacheIndex", options.indexKey.toString()]);
  }

  // public

  public async get(key: string): Promise<Array<string>> {
    return await this.getArray(key);
  }

  public async add(key: string, value: string, expiresInSeconds?: number): Promise<void> {
    const array = await this.getArray(key);

    array.unshift(value);

    await this.setArray(key, array, expiresInSeconds);
  }

  public async sub(key: string, value: Array<string>): Promise<void> {
    const array = await this.getArray(key);

    await this.setArray(
      key,
      array.filter((x) => !value.includes(x)),
    );
  }

  // private

  private async setArray(
    key: string,
    array: Array<string>,
    expiresInSeconds?: number,
  ): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    let result: string | null;

    const uniqueArray = [...new Set(array)];
    const indexKey = this.getKey(key);
    const data = JSON.stringify(uniqueArray);
    const method = expiresInSeconds ? "setex" : "set";

    if (expiresInSeconds) {
      result = await this.connection.client.setex(indexKey, expiresInSeconds, data);
    } else {
      result = await this.connection.client.set(indexKey, data);
    }

    const success = result === "OK";

    this.logger.debug("set index", {
      input: {
        method,
        array: uniqueArray,
        key,
      },
      result: {
        result,
        success,
        time: Date.now() - start,
      },
    });

    if (!success) {
      throw new RedisIndexError("Unable to set index in redis", {
        debug: {
          array: uniqueArray,
          data,
          indexKey,
          key,
        },
      });
    }
  }

  private async getArray(key: string): Promise<Array<string>> {
    const start = Date.now();

    await this.connection.connect();

    const indexKey = this.getKey(key);
    const result = await this.connection.client.get(indexKey);

    this.logger.debug("get index", {
      input: {
        method: "get",
        indexKey,
        key,
      },
      result: {
        success: !!result,
        time: Date.now() - start,
      },
    });

    if (result) {
      return JSON.parse(result);
    }

    return [];
  }

  private getKey(key: string): string {
    return `${this.connection.namespace}/index/${this.prefix}/${this.indexKey.toString()}/${key}`;
  }
}
