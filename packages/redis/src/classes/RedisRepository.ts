import { kebabCase } from "@lindorm/case";
import { expires } from "@lindorm/date";
import { isFunction, isString } from "@lindorm/is";
import { Primitive } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { filter, find } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { z } from "zod";
import { RedisRepositoryError } from "../errors";
import { Criteria, IRedisEntity, IRedisRepository } from "../interfaces";
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

  // public

  public create(options: O | E): E {
    const entity = this.createFn ? this.createFn(options) : this.handleCreate(options);

    this.validateBaseEntity(entity);

    this.logger.debug("Created entity", { entity });

    return entity;
  }

  public async count(criteria: Criteria<E> = {}): Promise<number> {
    const scan = await this.scan();
    const extended = this.createDefaultFilter(criteria);
    const entities = filter(scan, extended);

    this.logger.debug("Counted documents", {
      count: entities.length,
      criteria,
      entities,
    });

    return entities.length;
  }

  public async delete(criteria: Criteria<E>): Promise<void> {
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

  public async exists(criteria: Criteria<E>): Promise<boolean> {
    const count = await this.count(criteria);
    const exists = count >= 1;

    this.logger.debug("Repository done: exists", {
      input: {
        criteria,
      },
      result: {
        exists,
      },
    });

    if (count > 1) {
      this.logger.warn("Multiple documents found", {
        input: {
          criteria,
        },
        result: {
          count,
        },
      });
    }

    return exists;
  }

  public async find(criteria: Criteria<E> = {}): Promise<Array<E>> {
    if (isString(criteria.id)) {
      const entity = await this.findOneById(criteria.id);

      if (entity) {
        return [entity];
      }

      return [];
    }

    const scan = await this.scan();
    const extended = this.createDefaultFilter(criteria);
    const entities = filter(scan, extended);

    this.logger.debug("Repository done: find", {
      count: entities.length,
      criteria,
      entities,
    });

    return entities;
  }

  public async findOne(criteria: Criteria<E>): Promise<E | null> {
    if (isString(criteria.id)) {
      const entity = await this.findOneById(criteria.id);

      if (entity) {
        return entity;
      }

      return null;
    }

    const scan = await this.scan();
    const extended = this.createDefaultFilter(criteria);
    const entity = find(scan, extended);

    this.logger.debug("Repository done: findOne", {
      criteria,
      entity,
    });

    return entity ?? null;
  }

  public async findOneOrFail(criteria: Criteria<E>): Promise<E> {
    const entity = await this.findOne(criteria);

    if (!entity) {
      throw new RedisRepositoryError("Entity not found", { debug: { criteria } });
    }

    return entity;
  }

  public async findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E> {
    const entity = await this.findOne(criteria);
    if (entity) return entity;

    return this.save(this.create({ ...criteria, ...options } as O));
  }

  public async findOneById(id: string): Promise<E | null> {
    const start = Date.now();

    const key = this.key(id);

    try {
      const found = await this.client.get(key);

      const primitive = found ? new Primitive<E>(found).toJSON() : null;
      const document = primitive?.deletedAt === null ? primitive : null;

      this.logger.debug("Repository done: findOneById", {
        input: {
          id,
        },
        result: {
          document: found,
          time: Date.now() - start,
        },
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
          time: Date.now() - start,
        },
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

  public async ttl(criteria: Criteria<E>): Promise<number> {
    try {
      const entity = await this.findOneOrFail(criteria);
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

  private createDefaultFilter(criteria: Criteria<any> = {}): Criteria<any> {
    return {
      ...criteria,
      deletedAt: null,
    };
  }

  private handleCreate(options: O | E): E {
    const entity = new this.EntityConstructor(options);

    entity.id = (options.id as string) ?? entity.id ?? randomUUID();
    entity.rev = (options.rev as number) ?? entity.rev ?? 0;
    entity.seq = (options.seq as number) ?? entity.seq ?? 0;
    entity.createdAt = (options.createdAt as Date) ?? entity.createdAt ?? new Date();
    entity.updatedAt = (options.updatedAt as Date) ?? entity.updatedAt ?? new Date();
    entity.deletedAt = (options.deletedAt as Date) ?? (entity.deletedAt as Date) ?? null;
    entity.expiresAt = (options.expiresAt as Date) ?? (entity.expiresAt as Date) ?? null;

    return entity;
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
        if (data.deletedAt !== null) continue;

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
      rev: z.number().int().min(0),
      seq: z.number().int().min(0),
      createdAt: z.date(),
      updatedAt: z.date(),
      deletedAt: z.date().nullable(),
      expiresAt: z.date().nullable(),
    }).parse({
      id: entity.id,
      rev: entity.rev,
      seq: entity.seq,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      expiresAt: entity.expiresAt,
    });
  }

  private validateEntity(entity: E): void {
    this.validateBaseEntity(entity);

    if (isFunction(this.validateFn)) {
      const { id, rev, seq, createdAt, updatedAt, deletedAt, expiresAt, ...rest } =
        entity;
      this.validateFn(rest);
    }
  }
}
