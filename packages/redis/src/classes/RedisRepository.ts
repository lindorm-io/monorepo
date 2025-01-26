import { kebabCase } from "@lindorm/case";
import { expires } from "@lindorm/date";
import { isFunction, isString } from "@lindorm/is";
import { Primitive } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Predicate, Predicated } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { z } from "zod";
import { RedisRepositoryError } from "../errors";
import { IRedisEntity, IRedisRepository } from "../interfaces";
import {
  CreateRedisEntityFn,
  RedisRepositoryOptions,
  ValidateRedisEntityFn,
} from "../types";

export class RedisRepository<
  E extends IRedisEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IRedisRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly client: Redis;
  private readonly keyPattern: string;
  private readonly logger: ILogger;
  private readonly createFn: CreateRedisEntityFn<E> | undefined;
  private readonly validateFn: ValidateRedisEntityFn<E> | undefined;

  public constructor(options: RedisRepositoryOptions<E>) {
    this.logger = options.logger.child(["RedisRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
    this.keyPattern = this.createKeyPattern(options);
    this.client = options.client;

    this.createFn = options.create;
    this.validateFn = options.validate;
  }

  // public static

  public static createEntity<
    E extends IRedisEntity,
    O extends DeepPartial<E> = DeepPartial<E>,
  >(Entity: Constructor<E>, options: O | E): E {
    const entity = new Entity();

    const { id, createdAt, updatedAt, expiresAt, ...rest } = options as E;

    entity.id = id ?? entity.id ?? randomUUID();
    entity.createdAt = createdAt ?? entity.createdAt ?? new Date();
    entity.updatedAt = updatedAt ?? entity.updatedAt ?? new Date();
    entity.expiresAt = expiresAt ?? (entity.expiresAt as Date) ?? null;

    for (const [key, value] of Object.entries(rest)) {
      if (key === "_id") continue;
      entity[key as keyof E] = (value ?? null) as E[keyof E];
    }

    for (const [key, value] of Object.entries(entity)) {
      if (value !== undefined) continue;
      entity[key as keyof E] = null as E[keyof E];
    }

    return entity;
  }

  // public

  public create(options: O | E): E {
    const entity = this.createFn
      ? this.createFn(options)
      : RedisRepository.createEntity(this.EntityConstructor, options);

    this.validateBaseEntity(entity);

    this.logger.debug("Created entity", { entity });

    return entity;
  }

  public async count(predicate: Predicate<E> = {}): Promise<number> {
    const scan = await this.scan();
    const count = Predicated.filter(scan, predicate).length;

    this.logger.debug("Counted documents", {
      count,
      predicate,
    });

    return count;
  }

  public async delete(predicate: Predicate<E>): Promise<void> {
    if (isString(predicate.id)) {
      return this.deleteById(predicate.id);
    }

    const entities = await this.find(predicate);

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

    try {
      const result = await this.client.del(this.key(entity));
      const success = result === 1;

      this.logger.debug("Repository done: destroy", {
        entity,
        key: this.key(entity),
        result,
        success,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to destroy entity", { error });
    }
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(predicate: Predicate<E>): Promise<boolean> {
    const count = await this.count(predicate);
    const exists = count >= 1;

    this.logger.debug("Repository done: exists", {
      input: {
        predicate,
      },
      result: {
        exists,
      },
    });

    if (count > 1) {
      this.logger.warn("Multiple documents found", {
        input: {
          predicate,
        },
        result: {
          count,
        },
      });
    }

    return exists;
  }

  public async find(predicate: Predicate<E> = {}): Promise<Array<E>> {
    if (isString(predicate.id)) {
      const entity = await this.findOneById(predicate.id);

      if (entity) {
        return [entity];
      }

      return [];
    }

    const scan = await this.scan();
    const entities = Predicated.filter(scan, predicate);

    this.logger.debug("Repository done: find", {
      count: entities.length,
      predicate,
      entities,
    });

    return entities;
  }

  public async findOne(predicate: Predicate<E>): Promise<E | null> {
    if (isString(predicate.id)) {
      const entity = await this.findOneById(predicate.id);

      if (entity) {
        return entity;
      }

      return null;
    }

    const scan = await this.scan();
    const entity = Predicated.find(scan, predicate);

    this.logger.debug("Repository done: findOne", {
      predicate,
      entity,
    });

    return entity ?? null;
  }

  public async findOneOrFail(predicate: Predicate<E>): Promise<E> {
    const entity = await this.findOne(predicate);

    if (!entity) {
      throw new RedisRepositoryError("Entity not found", { debug: { predicate } });
    }

    return entity;
  }

  public async findOneOrSave(predicate: DeepPartial<E>, options?: O): Promise<E> {
    const entity = await this.findOne(predicate);
    if (entity) return entity;

    return this.save(this.create({ ...predicate, ...options } as O));
  }

  public async findOneById(id: string): Promise<E | null> {
    const start = Date.now();

    const key = this.key(id);

    try {
      const found = await this.client.get(key);

      const document = found ? new Primitive<E>(found).toJSON() : null;

      this.logger.debug("Repository done: findOneById", {
        input: {
          id,
        },
        result: {
          document: found,
        },
        time: Date.now() - start,
      });

      if (!document) return null;

      return this.create(document);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to find entity", { error });
    }
  }

  public async findOneByIdOrFail(id: string): Promise<E> {
    const entity = await this.findOneById(id);

    if (!entity) {
      throw new RedisRepositoryError("Entity not found");
    }

    return entity;
  }

  public async save(entity: E): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    try {
      const updated = this.updateEntityData(entity);

      const key = this.key(entity);
      const ttl = entity.expiresAt ? expires(entity.expiresAt) : null;
      const data = new Primitive(updated).toString();

      let result: string | null;

      if (ttl?.expiresIn) {
        result = await this.client.setex(key, ttl.expiresIn, data);
      } else {
        result = await this.client.set(key, data);
      }

      const success = result === "OK";

      this.logger.debug("Repository done: save", {
        input: {
          key,
          ttl,
          updated,
        },
        result: {
          result,
          success,
        },
        time: Date.now() - start,
      });

      return updated;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to save entity", { error });
    }
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async ttl(predicate: Predicate<E>): Promise<number> {
    try {
      const entity = await this.findOneOrFail(predicate);
      return this.client.ttl(this.key(entity));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to find ttl for entity", { error });
    }
  }

  public async ttlById(id: string): Promise<number> {
    try {
      return this.client.ttl(this.key(id));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to find ttl for entity by id", { error });
    }
  }

  // private

  private createKeyPattern(options: RedisRepositoryOptions<E>): string {
    const nsp = options.namespace ? `${kebabCase(options.namespace)}` : "default";
    const nam = `${kebabCase(options.Entity.name)}:`;

    const key = `${nsp}:entity:${nam}`;

    this.logger.debug("Created key", { key });

    return key;
  }

  private key(material: E | string): string {
    if (isString(material)) return `${this.keyPattern}${material}`;
    return `${this.keyPattern}${material.id}`;
  }

  private updateEntityData(entity: E): E {
    const updated = this.create(entity);

    updated.updatedAt = new Date();

    return updated;
  }

  private async scan(): Promise<Array<E>> {
    const start = Date.now();

    const keys: Array<string> = [];
    const entities: Array<E> = [];

    try {
      let cursor = "0";

      do {
        const reply = await this.client.scan(cursor, "MATCH", `${this.keyPattern}*`);
        cursor = reply[0];
        keys.push(...reply[1]);
      } while (cursor !== "0");

      for (const key of keys) {
        const result = await this.client.get(key);
        const data = new Primitive<E>(result).toJSON();

        entities.push(this.create(data));
      }

      this.logger.debug("Repository done: scan", {
        count: entities.length,
        time: Date.now() - start,
      });

      return entities;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Failed to scan entities", { error });
    }
  }

  private validateBaseEntity(entity: E): void {
    z.object({
      id: z.string().uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
      expiresAt: z.date().nullable(),
    }).parse({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      expiresAt: entity.expiresAt,
    });
  }

  private validateEntity(entity: E): void {
    this.validateBaseEntity(entity);

    if (isFunction(this.validateFn)) {
      const { id, createdAt, updatedAt, expiresAt, ...rest } = entity;
      this.validateFn(rest);
    }
  }
}
