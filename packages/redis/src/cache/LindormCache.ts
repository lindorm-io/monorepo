import { CacheBase } from "./CacheBase";
import { CacheIndex } from "./CacheIndex";
import { ICache, LindormCacheFindOptions, LindormCacheOptions, PostChangeCallback } from "../types";
import { RedisError } from "../error";
import { find, filter as _filter, flatten, uniqBy, snakeCase } from "lodash";
import { getUnixTime, isDate } from "date-fns";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  EntityAttributes,
  EntityNotCreatedError,
  EntityNotFoundError,
  EntityNotRemovedError,
  EntityNotUpdatedError,
  ILindormEntity,
} from "@lindorm-io/entity";

export abstract class LindormCache<
    Interface extends EntityAttributes,
    Entity extends ILindormEntity<Interface>,
  >
  extends CacheBase
  implements ICache<Interface, Entity>
{
  protected indices: Array<CacheIndex<Interface>>;
  protected prefix: string;
  protected ttlAttribute: keyof Interface | undefined;

  // protected

  protected constructor(options: LindormCacheOptions<Interface>) {
    super(options);

    this.indices = [];
    this.prefix = snakeCase(options.entityName);
    this.ttlAttribute = options.ttlAttribute;

    for (const attributeKey of options.indexedAttributes) {
      this.indices.push(
        new CacheIndex<Interface>({
          connection: options.connection,
          indexKey: attributeKey,
          logger: this.logger,
          prefix: options.entityName,
        }),
      );
    }
  }

  protected abstract createEntity(data: Interface): Entity;

  // public

  public async create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await entity.schemaValidation();

    try {
      await this.setEntity(entity);
    } catch (err: any) {
      throw new EntityNotCreatedError(err.message, {
        error: err,
      });
    }

    if (callback) {
      await callback(entity);
    }

    return entity;
  }

  public async createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.create(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async deleteMany(
    filter: Partial<Interface>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>> {
    const results: Array<Entity> = await this.filterEntities(filter, { scan: true });

    if (!results.length) return;

    const promises = [];

    for (const entity of results) {
      promises.push(this.destroy(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void> {
    await this.delEntity(entity);

    if (callback) {
      await callback(entity);
    }
  }

  public async destroyMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>> {
    const promises: Array<Promise<void>> = [];

    for (const entity of entities) {
      promises.push(this.destroy(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async find(
    filter: Partial<Interface>,
    options?: LindormCacheFindOptions,
  ): Promise<Entity> {
    const results: Array<Entity> = await this.filterEntities(filter, options);

    if (results.length) {
      const found = find(results, filter) as unknown as Entity;

      if (found) {
        return found;
      }
    }

    throw new EntityNotFoundError("Unable to find entity", {
      debug: { filter },
    });
  }

  public async findMany(
    filter: Partial<Interface>,
    options?: LindormCacheFindOptions,
  ): Promise<Array<Entity>> {
    if (Object.keys(filter).length) {
      return await this.filterEntities(filter, options);
    }

    return await this.scanEntities();
  }

  public async findOrCreate(
    filter: Partial<Interface>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity> {
    try {
      return await this.find(filter);
    } catch (err: any) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }

      return await this.create(this.createEntity(filter as Interface), callback);
    }
  }

  public async tryFind(
    filter: Partial<Interface>,
    options?: LindormCacheFindOptions,
  ): Promise<Entity | null> {
    try {
      return await this.find(filter, options);
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        return null;
      }
      throw err;
    }
  }

  public async ttl(entity: Entity): Promise<number> {
    return await this.client.ttl(this.getKey(entity.id));
  }

  public async update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await entity.schemaValidation();

    entity.updated = new Date();

    try {
      await this.setEntity(entity);
    } catch (err: any) {
      throw new EntityNotUpdatedError(err.message, {
        error: err,
      });
    }

    if (callback) {
      await callback(entity);
    }

    return entity;
  }

  public async updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.update(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  // private

  private async filterEntities(
    filter: Partial<Interface>,
    options: LindormCacheFindOptions = {},
  ): Promise<Array<Entity>> {
    const { scan = true } = options || {};

    if (filter.id) {
      const entity = await this.getEntity(filter.id);

      if (entity) {
        return [entity];
      }

      return [];
    }

    let results: Array<Entity> = await this.indexEntities(filter);

    if (!results.length && scan) {
      results = await this.scanEntities();
    }

    return _filter(results, filter) as Array<Entity>;
  }

  private async indexEntities(filter: Partial<Interface>): Promise<Array<Entity>> {
    const results: Array<Entity> = [];

    for (const [key, value] of Object.entries(filter)) {
      const index = find(this.indices, (idx) => idx.indexKey === key);

      if (!index) {
        continue;
      }

      const entityIds = await index.get(value);
      const cleanup: Array<string> = [];

      for (const id of entityIds) {
        const entity = await this.getEntity(id);

        if (entity) {
          results.push(entity);
        } else {
          cleanup.push(id);
        }
      }

      if (cleanup.length) {
        this.logger.debug("cleanup invoked", {
          cleanup,
        });

        await index.sub(key, cleanup);
      }
    }

    return uniqBy(results, (entity) => entity.id);
  }

  private async scanEntities(): Promise<Array<Entity>> {
    const start = Date.now();

    await this.connection.waitForConnection();

    let cursor = 0;
    let entityKeys: Array<string> = [];

    do {
      const [cursorString, keys] = await this.client.scan(cursor, "MATCH", this.getKey("*"));

      cursor = parseInt(cursorString, 10);
      entityKeys = flatten([entityKeys, keys]);
    } while (cursor !== 0);

    this.logger.debug("scan entities", {
      input: {
        method: "scan",
      },
      result: {
        success: !!entityKeys.length,
        time: Date.now() - start,
      },
    });

    const results: Array<Entity> = [];

    for (const key of entityKeys) {
      const id = key.replace(this.getKey(""), "");
      const entity = await this.getEntity(id);

      if (entity) {
        results.push(entity);
      }
    }

    return uniqBy(results, (entity) => entity.id);
  }

  private async getEntity(id: string): Promise<Entity | null> {
    const start = Date.now();

    await this.connection.waitForConnection();

    const key = this.getKey(id);
    const result = await this.client.get(key);

    this.logger.debug("get entity", {
      input: {
        method: "get",
        id,
        key,
      },
      result: {
        success: !!result,
        time: Date.now() - start,
      },
    });

    if (result) {
      return this.createEntity(parseBlob(result) as Interface);
    }

    return null;
  }

  private async setEntity(entity: Entity): Promise<void> {
    const start = Date.now();

    await this.connection.waitForConnection();

    entity.updated = new Date();

    const json = entity.toJSON();
    const key = this.getKey(json.id);
    const blob = stringifyBlob(json);
    const expiresInSeconds = this.getExpiry(json);
    const method = expiresInSeconds ? "setex" : "set";

    let result: string | null;

    if (expiresInSeconds) {
      result = await this.client.setex(key, expiresInSeconds, blob);
    } else {
      result = await this.client.set(key, blob);
    }

    const success = result === "OK";

    this.logger.debug("set entity", {
      input: {
        expiresInSeconds,
        json,
        key,
        method,
      },
      result: {
        result,
        success,
        time: Date.now() - start,
      },
    });

    if (success) {
      for (const index of this.indices) {
        const indexKey = json[index.indexKey as keyof Interface] as unknown as string;

        await index.add(indexKey, json.id, expiresInSeconds);
      }

      return;
    }

    throw new RedisError("Unable to set entity", {
      debug: { key, json, result },
    });
  }

  private async delEntity(entity: Entity): Promise<void> {
    const start = Date.now();

    await this.connection.waitForConnection();

    const json = entity.toJSON();
    const key = this.getKey(json.id);

    const result = await this.client.del(key);
    const success = result !== 0;

    this.logger.debug("del entity", {
      input: {
        key,
      },
      result: {
        success,
        time: Date.now() - start,
      },
    });

    if (success) {
      for (const index of this.indices) {
        const indexKey = json[index.indexKey as keyof Interface] as unknown as string;

        await index.sub(indexKey, [json.id]);
      }

      return;
    }

    throw new EntityNotRemovedError("Unable to delete entity", {
      debug: { key, deletedRows: result },
    });
  }

  private getKey(key: string): string {
    return `entity::${this.prefix}::${key}`;
  }

  private getExpiry(entity: Interface): number | undefined {
    if (!this.ttlAttribute) return;

    const attribute = entity[this.ttlAttribute];

    if (!isDate(attribute)) {
      this.logger.warn("TTL Attribute is not a date", {
        key: this.ttlAttribute,
        value: attribute,
        expect: "Date",
        actual: typeof attribute,
      });
      return;
    }

    return getUnixTime(attribute as unknown as Date) - getUnixTime(new Date());
  }
}
