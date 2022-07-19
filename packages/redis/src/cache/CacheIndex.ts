import { CacheIndexBaseOptions, ICacheBase } from "../types";
import { ILogger } from "@lindorm-io/winston";
import { RedisConnection } from "../infrastructure";
import { RedisError } from "../error";
import { difference, snakeCase, uniq } from "lodash";

export class CacheIndex<Interface> implements ICacheBase {
  private readonly connection: RedisConnection;
  private readonly logger: ILogger;
  private readonly prefix: string;

  public readonly indexKey: keyof Interface;

  public constructor(options: CacheIndexBaseOptions<Interface>) {
    this.connection = options.connection;
    this.indexKey = options.indexKey;
    this.prefix = snakeCase(options.prefix);

    this.logger = options.logger.createChildLogger(["CacheIndex", options.indexKey.toString()]);
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

    await this.setArray(key, difference(array, value));
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

    const uniqueArray = uniq(array);
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
      throw new RedisError("Unable to set index in cache", {
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
    return `index::${this.prefix}::${this.indexKey.toString()}::${key}`;
  }
}
