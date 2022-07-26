import { CacheIndex } from "./CacheIndex";
import { CacheStore } from "./CacheStore";
import { RedisBase } from "./RedisBase";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  CacheRepositoryData,
  CacheRepositoryOptions,
  CacheStoreAttributes,
  HandlerIdentifier,
  State,
} from "../types";

export class CacheRepository extends RedisBase {
  private readonly index: CacheIndex;
  private readonly identifier: HandlerIdentifier;

  public constructor(options: CacheRepositoryOptions) {
    super(options);

    this.identifier = options.cache;
    this.index = new CacheIndex({
      connection: this.connection,
      logger: this.logger,
    });
  }

  public async get<S = State>(id: string): Promise<CacheRepositoryData<S> | null> {
    const start = Date.now();

    await this.promise();

    try {
      const result = await this.connection.client.get(this.getKey(id));

      if (!result) {
        this.logger.debug("Returning null", {
          result,
          time: Date.now() - start,
        });

        return null;
      }

      const json = parseBlob<CacheStoreAttributes<S>>(result);

      if (json.destroyed) {
        this.logger.debug("Returning null due to destroyed status", {
          json,
          time: Date.now() - start,
        });

        return null;
      }

      this.logger.debug("Returning Cache data", {
        json,
        time: Date.now() - start,
      });

      return {
        id,
        revision: json.revision,
        state: json.state,
      };
    } catch (err) {
      this.logger.error("Failed to find Cache data", err);

      throw err;
    }
  }

  public async getAll<S = State>(): Promise<Array<CacheRepositoryData<S>>> {
    const start = Date.now();

    await this.promise();

    try {
      const index = await this.index.get(this.identifier);
      const array: Array<CacheStoreAttributes<S>> = [];

      for (const id of index) {
        const result = await this.connection.client.get(this.getKey(id));

        if (!result) continue;

        const json = parseBlob<CacheStoreAttributes<S>>(result);

        if (json.destroyed) continue;

        array.push(json);
      }

      this.logger.debug("Returning Cache data", {
        array,
        time: Date.now() - start,
      });

      return array.map((item) => ({
        id: item.id,
        revision: item.revision,
        state: item.state,
      }));
    } catch (err) {
      this.logger.error("Failed to find Cache data", err);

      throw err;
    }
  }

  private getKey(id: string): string {
    return CacheStore.getKey({ ...this.identifier, id });
  }
}
