import { Logger } from "@lindorm-io/core-logger";
import { RedisRepositoryError } from "../errors";
import { RedisIndex } from "./RedisIndex";
import { filter as _filter, find, uniqBy } from "lodash";
import { getUnixTime } from "date-fns";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import { snakeCase } from "@lindorm-io/case";
import {
  IRedisConnection,
  PostChangeCallback,
  RedisDocument,
  RedisEntity,
  RedisRepository,
  RedisRepositoryFindOptions,
  RedisRepositoryOptions,
} from "../types";
import {
  EntityNotCreatedError,
  EntityNotFoundError,
  EntityNotRemovedError,
  EntityNotUpdatedError,
} from "@lindorm-io/entity";

export abstract class RedisRepositoryBase<
  Document extends RedisDocument,
  Entity extends RedisEntity,
> implements RedisRepository<Document, Entity>
{
  private readonly connection: IRedisConnection;
  private readonly indices: Array<RedisIndex<Document>>;
  private readonly logger: Logger;
  private readonly prefix: string;
  private readonly ttlAttribute: keyof Document | undefined;

  // protected

  protected constructor(
    connection: IRedisConnection,
    logger: Logger,
    options: RedisRepositoryOptions<Document>,
  ) {
    this.logger = logger.createChildLogger([
      "RedisCacheBase",
      connection.namespace,
      this.constructor.name,
    ]);

    this.connection = connection;
    this.indices = [];
    this.prefix = snakeCase(options.entityName);
    this.ttlAttribute = options.ttlAttribute;

    for (const attributeKey of options.indexedAttributes) {
      this.indices.push(
        new RedisIndex<Document>(connection, this.logger, {
          indexKey: attributeKey,
          prefix: options.entityName,
        }),
      );
    }
  }

  protected abstract createDocument(entity: Entity): Document;

  protected abstract createEntity(document: Document): Entity;

  protected abstract validateSchema(entity: Entity): Promise<void>;

  // public

  public async create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

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
  ): Promise<Array<Entity>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.create(entity, callback));
    }

    return await Promise.all(promises);
  }

  public async deleteMany(
    filter: Partial<Document>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<void> {
    const results: Array<Entity> = await this.filterEntities(filter, { scan: true });

    const promises = [];

    for (const entity of results) {
      promises.push(this.destroy(entity, callback));
    }

    await Promise.all(promises);
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
  ): Promise<void> {
    const promises: Array<Promise<void>> = [];

    for (const entity of entities) {
      promises.push(this.destroy(entity, callback));
    }

    await Promise.all(promises);
  }

  public async find(
    filter: Partial<Document>,
    options?: RedisRepositoryFindOptions,
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
    filter: Partial<Document>,
    options?: RedisRepositoryFindOptions,
  ): Promise<Array<Entity>> {
    if (Object.keys(filter).length) {
      return await this.filterEntities(filter, options);
    }

    return await this.scanEntities();
  }

  public async findOrCreate(
    filter: Partial<Document>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity> {
    try {
      return await this.find(filter);
    } catch (err: any) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }

      return await this.create(this.createEntity(filter as Document), callback);
    }
  }

  public async tryFind(
    filter: Partial<Document>,
    options?: RedisRepositoryFindOptions,
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
    return this.connection.client.ttl(this.getKey(entity.id));
  }

  public async update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

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
  ): Promise<Array<Entity>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.update(entity, callback));
    }

    return await Promise.all(promises);
  }

  public async upsert(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

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

  // private

  private async filterEntities(
    filter: Partial<Document>,
    options: RedisRepositoryFindOptions = {},
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

  private async indexEntities(filter: Partial<Document>): Promise<Array<Entity>> {
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

    return uniqBy(results, "id");
  }

  private async scanEntities(): Promise<Array<Entity>> {
    const start = Date.now();

    await this.connection.connect();

    let cursor = 0;
    let entityKeys: Array<string> = [];

    do {
      const [cursorString, keys] = await this.connection.client.scan(
        cursor,
        "MATCH",
        this.getKey("*"),
      );

      cursor = parseInt(cursorString, 10);
      entityKeys = [entityKeys, keys].flat();
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

    return uniqBy(results, "id");
  }

  private async getEntity(id: string): Promise<Entity | null> {
    const start = Date.now();

    await this.connection.connect();

    const key = this.getKey(id);
    const result = await this.connection.client.get(key);

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
      return this.createEntity(parseBlob(result) as Document);
    }

    return null;
  }

  private async setEntity(entity: Entity): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    entity.updated = new Date();

    const document = this.createDocument(entity);
    const key = this.getKey(document.id);
    const blob = stringifyBlob(document);
    const expiresInSeconds = this.getExpiry(document);
    const method = expiresInSeconds ? "setex" : "set";

    let result: string | null;

    if (expiresInSeconds) {
      result = await this.connection.client.setex(key, expiresInSeconds, blob);
    } else {
      result = await this.connection.client.set(key, blob);
    }

    const success = result === "OK";

    this.logger.debug("set entity", {
      input: {
        expiresInSeconds,
        document,
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
        const indexKey = document[index.indexKey as keyof Document] as unknown as string;
        if (!indexKey) continue;

        await index.add(indexKey, document.id, expiresInSeconds);
      }

      return;
    }

    throw new RedisRepositoryError("Unable to set entity", {
      debug: { key, document, result },
    });
  }

  private async delEntity(entity: Entity): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    const document = this.createDocument(entity);
    const key = this.getKey(document.id);

    const result = await this.connection.client.del(key);
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
        const indexKey = document[index.indexKey as keyof Document] as unknown as string;

        await index.sub(indexKey, [document.id]);
      }

      return;
    }

    throw new EntityNotRemovedError("Unable to delete entity", {
      debug: { key, deletedRows: result },
    });
  }

  private getKey(key: string): string {
    return `${this.connection.namespace}/entity/${this.prefix}/${key}`;
  }

  private getExpiry(entity: Document): number | undefined {
    if (!this.ttlAttribute) return;

    const attribute = entity[this.ttlAttribute];

    if (!(attribute instanceof Date)) {
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
