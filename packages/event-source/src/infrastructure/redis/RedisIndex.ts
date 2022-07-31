import { ILogger } from "@lindorm-io/winston";
import { IRedisConnection } from "@lindorm-io/redis";
import { LindormError } from "@lindorm-io/errors";
import { RedisBase } from "./RedisBase";
import { StandardIdentifier, HandlerIdentifier } from "../../types";
import { snakeCase, uniq } from "lodash";

export class RedisIndex extends RedisBase {
  public constructor(connection: IRedisConnection, logger: ILogger) {
    super({ connection }, logger);
  }

  public async get(identifier: HandlerIdentifier): Promise<Array<string>> {
    return await this.getArray(identifier);
  }

  public async push(entity: StandardIdentifier): Promise<void> {
    const array = await this.getArray(entity);

    array.push(entity.id);

    await this.setArray(entity, array);
  }

  // private

  private async getArray(entity: HandlerIdentifier): Promise<Array<string>> {
    const start = Date.now();

    await this.promise();

    const key = RedisIndex.getKey(entity);
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

  private async setArray(entity: HandlerIdentifier, array: Array<string>): Promise<void> {
    const start = Date.now();

    await this.promise();

    try {
      const key = RedisIndex.getKey(entity);
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

  private static getKey(entity: HandlerIdentifier): string {
    return `${snakeCase(entity.context)}::${snakeCase(entity.name)}::index`;
  }
}
