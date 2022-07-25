import { CacheIdentifier, CacheStoreOptions, HandlerIdentifier } from "../types";
import { LindormError } from "@lindorm-io/errors";
import { RedisBase } from "./RedisBase";
import { snakeCase, uniq } from "lodash";

export class CacheIndex extends RedisBase {
  public constructor(options: CacheStoreOptions) {
    super(options);
  }

  public async get(cache: HandlerIdentifier): Promise<Array<string>> {
    return await this.getArray(cache);
  }

  public async push(cache: CacheIdentifier): Promise<void> {
    const array = await this.getArray(cache);

    array.push(cache.id);

    await this.setArray(cache, array);
  }

  // private

  private async getArray(cache: HandlerIdentifier): Promise<Array<string>> {
    const start = Date.now();

    await this.promise();

    const key = CacheIndex.getKey(cache);
    const result = await this.connection.client.get(key);

    if (result) {
      const array = JSON.parse(result);

      this.logger.debug("Returning index", {
        key,
        result,
        array,
        time: Date.now() - start,
      });

      return array;
    }

    this.logger.debug("Returning ephemeral index", {
      key,
      result,
      time: Date.now() - start,
    });

    return [];
  }

  private async setArray(cache: HandlerIdentifier, array: Array<string>): Promise<void> {
    const start = Date.now();

    await this.promise();

    try {
      const key = CacheIndex.getKey(cache);
      const value = JSON.stringify(uniq(array));
      const result = await this.connection.client.set(key, value);

      if (result !== "OK") {
        throw new LindormError("Invalid result", {
          debug: { result },
        });
      }

      this.logger.debug("Successfully set index", {
        key,
        time: Date.now() - start,
      });
    } catch (err) {
      this.logger.debug("Failed to set index", err);

      throw err;
    }
  }

  private static getKey(cache: HandlerIdentifier): string {
    return `${snakeCase(cache.context)}::${snakeCase(cache.name)}::index`;
  }
}
