import { kebabCase } from "@lindorm/case";
import { expires } from "@lindorm/date";
import { isFunction, isString } from "@lindorm/is";
import { Primitive } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { filter, find } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { RedisError } from "../errors";
import { Criteria, IRedisEntity, IRedisRepository } from "../interfaces";
import { RedisRepositoryOptions } from "../types";

export class RedisRepository<E extends IRedisEntity> implements IRedisRepository<E> {
  private readonly EntityConstructor: Constructor<E>;
  private readonly keyPattern: string;
  private readonly logger: ILogger;
  private readonly redis: Redis;
  private readonly useCache: boolean;
  private cache: Array<E>;

  public constructor(options: RedisRepositoryOptions<E>) {
    this.EntityConstructor = options.Entity;

    this.logger = options.logger.child(["RedisRepository", options.Entity.name]);
    this.redis = options.redis;
    this.keyPattern = this.createKeyPattern(options);
    this.useCache = options.useCache ?? false;

    this.cache = [];
  }

  // public

  public async count(criteria: Criteria<E> = {}): Promise<number> {
    const scan = await this.scan();
    const entities = filter(scan, criteria);

    this.logger.silly("Counted entities", {
      count: entities.length,
      criteria,
      entities,
    });

    return entities.length;
  }

  public create(partial: DeepPartial<E> = {}): E {
    const entity = new this.EntityConstructor(partial);

    entity.id = entity.id ?? partial.id ?? randomUUID();

    for (const [key, value] of Object.entries(partial)) {
      if (value === undefined) continue;
      if (entity[key as keyof E] !== undefined) continue;

      entity[key as keyof E] = value as E[keyof E];
    }

    return entity;
  }

  public async delete(criteria: Criteria<E>): Promise<void> {
    this.logger.silly("Deleting entities", { criteria });

    if (isString(criteria.id)) {
      return this.deleteById(criteria.id);
    }

    const entities = await this.find(criteria);

    for (const entity of entities) {
      await this.destroy(entity);
    }
  }

  public async deleteById(id: string): Promise<void> {
    const entity = await this.findOneById(id);

    if (entity) {
      await this.destroy(entity);
    }
  }

  public async destroy(entity: E): Promise<void> {
    const start = Date.now();

    const result = await this.redis.del(this.key(entity));
    const success = result === 1;

    if (success) {
      this.destroyEntityFromCache(entity);
    }

    this.logger.silly("Destroyed entity", {
      entity,
      key: this.key(entity),
      result,
      success,
      time: Date.now() - start,
    });
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(criteria: Criteria<E>): Promise<boolean> {
    this.logger.silly("Checking entity existence", { criteria });

    const entity = await this.findOne(criteria);

    return Boolean(entity);
  }

  public async find(criteria: Criteria<E> = {}): Promise<Array<E>> {
    this.logger.silly("Finding entities", { criteria });

    if (isString(criteria.id)) {
      const entity = await this.findOneById(criteria.id);
      if (entity) return [entity];
      return [];
    }

    const scan = await this.scan();
    const entities = filter(scan, criteria);

    this.logger.silly("Found entities", {
      count: entities.length,
      criteria,
      entities,
    });

    return entities;
  }

  public async findOne(criteria: Criteria<E>): Promise<E | null> {
    this.logger.silly("Finding entity", { criteria });

    if (isString(criteria.id)) {
      const entity = await this.findOneById(criteria.id);
      if (entity) return entity;
      return null;
    }

    const scan = await this.scan();
    const entity = find(scan, criteria);

    this.logger.silly("Found entity", {
      criteria,
      entity,
    });

    return entity || null;
  }

  public async findOneById(id: string): Promise<E | null> {
    const start = Date.now();

    const key = this.key(id);
    const result = await this.redis.get(key);

    if (!result) {
      this.logger.silly("Entity not found", {
        result,
        key,
        time: Date.now() - start,
      });

      return null;
    }

    const data = new Primitive<E>(result).toJSON();
    const entity = this.create(data);

    this.logger.silly("Found entity", {
      entity,
      key,
      result,
      time: Date.now() - start,
    });

    return entity;
  }

  public async findOneByIdOrFail(id: string): Promise<E> {
    const entity = await this.findOneById(id);

    if (!entity) {
      throw new RedisError("Entity not found");
    }

    return entity;
  }

  public async findOneOrFail(criteria: Criteria<E>): Promise<E> {
    const entity = await this.findOne(criteria);

    if (!entity) {
      throw new RedisError("Entity not found");
    }

    return entity;
  }

  public async findOneOrSave(criteria: Criteria<E>): Promise<E> {
    const entity = await this.findOne(criteria);
    if (entity) return entity;

    return this.save(this.create(criteria));
  }

  public async save(entity: E): Promise<E> {
    const start = Date.now();

    entity.createdAt = entity.createdAt ?? new Date();
    entity.updatedAt = new Date();

    const json = isFunction(entity.toJSON) ? entity.toJSON() : entity;

    if (isFunction(entity.validate)) {
      entity.validate();
    }

    const key = this.key(entity);
    const ttl = entity.expiresAt ? expires(entity.expiresAt) : undefined;
    const data = new Primitive(json).toString();

    let result: string | null;

    if (ttl?.expiresIn) {
      result = await this.redis.setex(key, ttl.expiresIn, data);
    } else {
      result = await this.redis.set(key, data);
    }

    const success = result === "OK";

    if (success) {
      this.saveEntityToCache(entity);
    }

    this.logger.silly("Saved entity", {
      entity,
      key,
      result,
      success,
      time: Date.now() - start,
    });

    return entity;
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async ttl(entity: E): Promise<number> {
    return this.redis.ttl(this.key(entity));
  }

  public async ttlById(id: string): Promise<number> {
    return this.redis.ttl(this.key(id));
  }

  // private

  private createKeyPattern(options: RedisRepositoryOptions<E>): string {
    const nsp = options.namespace ? `${kebabCase(options.namespace)}:` : "";
    const ent = `${kebabCase(options.Entity.name)}:`;

    const key = `${nsp}entity:${ent}`;

    this.logger.silly("Created key", { key });

    return key;
  }

  private key(material: E | string): string {
    if (isString(material)) return `${this.keyPattern}${material}`;
    return `${this.keyPattern}${material.id}`;
  }

  private saveEntityToCache(entity: E): void {
    if (!this.useCache || !this.cache.length) return;

    const start = Date.now();

    this.cache = this.cache.filter((item) => item.id !== entity.id);
    this.cache.push(entity);

    this.logger.silly("Saved entity to cache", {
      entity,
      time: Date.now() - start,
    });
  }

  private destroyEntityFromCache(entity: E): void {
    if (!this.useCache || !this.cache.length) return;

    const start = Date.now();

    this.cache = this.cache.filter((item) => item.id !== entity.id);

    this.logger.silly("Destroyed entity from cache", {
      entity,
      time: Date.now() - start,
    });
  }

  private async scan(): Promise<Array<E>> {
    if (this.useCache && this.cache.length) return this.cache;

    const start = Date.now();

    const keys: Array<string> = [];
    const entities: Array<E> = [];

    let cursor = "0";

    do {
      const reply = await this.redis.scan(cursor, "MATCH", `${this.keyPattern}*`);
      cursor = reply[0];
      keys.push(...reply[1]);
    } while (cursor !== "0");

    for (const key of keys) {
      const result = await this.redis.get(key);
      const data = new Primitive<E>(result).toJSON();

      entities.push(this.create(data));
    }

    this.logger.silly("Scanned entities", {
      count: entities.length,
      time: Date.now() - start,
    });

    this.cache = entities;

    return entities;
  }
}
