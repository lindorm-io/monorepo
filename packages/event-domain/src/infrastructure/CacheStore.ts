import { Cache } from "../entity";
import { CacheIndex } from "./CacheIndex";
import { CacheNotSavedError, CacheNotUpdatedError } from "../error";
import { DomainEvent, Message } from "../message";
import { RedisBase } from "./RedisBase";
import { difference, find, flatten, snakeCase } from "lodash";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  CacheData,
  CacheIdentifier,
  CacheStoreAttributes,
  CacheStoreOptions,
  ICacheStore,
} from "../types";

export class CacheStore extends RedisBase implements ICacheStore {
  private readonly index: CacheIndex;

  public constructor(options: CacheStoreOptions) {
    super(options);

    this.index = new CacheIndex({
      connection: this.connection,
      logger: this.logger,
    });
  }

  // public

  public async save(cache: Cache, causation: Message): Promise<Cache> {
    const start = Date.now();
    const json = cache.toJSON();

    this.logger.debug("Saving Cache", {
      cache: json,
      causation,
    });

    const existing = await this.find(json);

    if (existing && find(existing.causationList, (item) => item === causation.id)) {
      this.logger.debug("Returning existing Cache without change", {
        cache: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    if (cache.revision === 0) {
      if (existing) {
        throw new CacheNotSavedError("Cache revision is 0 while existing cache in store");
      }

      this.logger.debug("Creating new Cache", {
        cache: json,
        time: Date.now() - start,
      });

      return await this.create(cache, causation);
    }

    this.logger.debug("Updating existing View", {
      view: json,
      time: Date.now() - start,
    });

    return await this.update(cache, causation);
  }

  public async load(cacheIdentifier: CacheIdentifier): Promise<Cache> {
    const start = Date.now();

    this.logger.debug("Loading Cache", { cacheIdentifier });

    const existing = await this.find(cacheIdentifier);

    if (existing) {
      this.logger.debug("Returning existing Cache document", {
        cache: existing.toJSON(),
        time: Date.now() - start,
      });

      return existing;
    }

    const cache = new Cache(cacheIdentifier, this.logger);

    this.logger.debug("Returning ephemeral Cache", {
      cache: cache.toJSON(),
      time: Date.now() - start,
    });

    return cache;
  }

  // private

  private async find(cacheIdentifier: CacheIdentifier): Promise<Cache | undefined> {
    const start = Date.now();

    await this.promise();

    try {
      const key = CacheStore.getKey(cacheIdentifier);
      const result = await this.connection.client.get(key);

      if (result) {
        const cache = new Cache(parseBlob<CacheStoreAttributes>(result), this.logger);

        this.logger.debug("Returning existing Cache document", {
          key,
          result,
          cache: cache.toJSON(),
          time: Date.now() - start,
        });

        return cache;
      }

      this.logger.debug("Found no existing Cache document", {
        time: Date.now() - start,
      });
    } catch (err) {
      this.logger.error("Failed to find Cache document", err);

      throw err;
    }
  }

  private async create(cache: Cache, causation: DomainEvent): Promise<Cache> {
    const start = Date.now();

    await this.promise();

    const cacheData: CacheData = {
      id: cache.id,
      name: cache.name,
      context: cache.context,

      causationList: [causation.id],
      destroyed: cache.destroyed,
      meta: cache.meta,
      revision: cache.revision + 1,
      state: cache.state,
    };

    this.logger.debug("Creating Cache document", { cacheData });

    try {
      const key = CacheStore.getKey(cacheData);
      const blob = stringifyBlob(cacheData);
      const result = await this.connection.client.set(key, blob);

      await this.index.push(cacheData);

      this.logger.debug("Created Cache document", {
        key,
        blob,
        result,
        time: Date.now() - start,
      });

      return new Cache(cacheData, this.logger);
    } catch (err) {
      this.logger.error("Failed to create Cache document", err);

      throw err;
    }
  }

  private async update(cache: Cache, causation: DomainEvent): Promise<Cache> {
    const start = Date.now();

    await this.promise();

    const cacheData: CacheData = {
      id: cache.id,
      name: cache.name,
      context: cache.context,

      causationList: flatten([cache.causationList, causation.id]),
      destroyed: cache.destroyed,
      meta: cache.meta,
      revision: cache.revision + 1,
      state: cache.state,
    };

    await this.assertRevision(cache);

    try {
      const key = CacheStore.getKey(cache);
      const blob = stringifyBlob(cacheData);
      const result = await this.connection.client.set(key, blob);

      if (result !== "OK") {
        throw new CacheNotUpdatedError("Client failed to set document");
      }

      this.logger.debug("Updated Cache document", {
        key,
        blob,
        result,
        time: Date.now() - start,
      });

      return new Cache(cacheData, this.logger);
    } catch (err) {
      this.logger.error("Failed to update Cache document", err);

      throw err;
    }
  }

  private async assertRevision(cache: Cache): Promise<void> {
    const start = Date.now();

    await this.promise();

    try {
      const key = CacheStore.getKey(cache);
      const result = await this.connection.client.get(key);

      if (!result) {
        throw new CacheNotUpdatedError("Document not found");
      }

      const attributes = parseBlob<CacheStoreAttributes>(result);

      if (attributes.revision !== cache.revision) {
        throw new CacheNotUpdatedError("Incorrect document revision");
      }

      const diff = difference(cache.causationList, attributes.causationList);

      if (diff.length) {
        throw new CacheNotUpdatedError("Incorrect causation list");
      }

      this.logger.debug("Asserted cache revision", {
        causationList: cache.causationList,
        diff,
        key,
        revision: cache.revision,
        time: Date.now() - start,
      });
    } catch (err) {
      this.logger.debug("Failed to assert Cache data", err);

      throw err;
    }
  }

  // static

  public static getKey(cacheIdentifier: CacheIdentifier): string {
    return `${snakeCase(cacheIdentifier.context)}::${snakeCase(cacheIdentifier.name)}::item::${
      cacheIdentifier.id
    }`;
  }
}
