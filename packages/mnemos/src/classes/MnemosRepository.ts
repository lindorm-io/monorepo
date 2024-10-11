import { IEntity } from "@lindorm/entity";
import { isFunction } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MnemosRepositoryError } from "../errors";
import { IMnemosCollection, IMnemosRepository } from "../interfaces";
import {
  CreateMnemosEntityFn,
  MnemosRepositoryOptions,
  ValidateMnemosEntityFn,
} from "../types";

export class MnemosRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IMnemosRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly collection: IMnemosCollection<E>;
  private readonly logger: ILogger;
  private readonly createFn: CreateMnemosEntityFn<E> | undefined;
  private readonly validateFn: ValidateMnemosEntityFn<E> | undefined;

  public constructor(options: MnemosRepositoryOptions<E>) {
    this.logger = options.logger.child(["MnemosRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
    this.collection = options.cache.collection(options.Entity.name, options);

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

  public count(predicate: Predicate<E>): number {
    const count = this.filter(predicate).length;

    this.logger.debug("Repository done: count", {
      count,
      predicate,
    });

    return count;
  }

  public delete(predicate: Predicate<E>): void {
    this.collection.delete(predicate);

    this.logger.debug("Repository done: delete", {
      predicate,
    });
  }

  public deleteById(id: string): void {
    this.collection.delete({ id });

    this.logger.debug("Repository done: deleteById", {
      id,
    });
  }

  public destroy(entity: E): void {
    this.collection.delete({ id: entity.id });

    this.logger.debug("Repository done: destroy", {
      id: entity.id,
    });
  }

  public destroyBulk(entities: Array<E>): void {
    for (const entity of entities) {
      this.collection.delete({ id: entity.id });
    }
  }

  public exists(predicate: Predicate<E>): boolean {
    const entities = this.filter(predicate);
    const exists = entities.length > 0;

    this.logger.debug("Repository done: exists", {
      exists,
      predicate,
    });

    return exists;
  }

  public find(predicate: Predicate<E> = {}): Array<E> {
    const entities = this.filter(predicate);

    this.logger.debug("Repository done: find", {
      count: entities.length,
      predicate,
      entities,
    });

    return entities;
  }

  public findOne(predicate: Predicate<E>): E | null {
    const [entity] = this.filter(predicate);

    this.logger.debug("Repository done: findOne", {
      predicate,
      entity,
    });

    return entity ?? null;
  }

  public findOneOrFail(predicate: Predicate<E>): E {
    const entity = this.findOne(predicate);

    if (!entity) {
      throw new MnemosRepositoryError("Entity not found", { debug: { predicate } });
    }

    return entity;
  }

  public findOneOrSave(predicate: Predicate<E>, options?: O): E {
    const entity = this.findOne(predicate);
    if (entity) return entity;

    return this.save(this.create({ ...predicate, ...options } as O));
  }

  public findOneById(id: string): E | null {
    return this.findOne({ id });
  }

  public findOneByIdOrFail(id: string): E {
    return this.findOneOrFail({ id });
  }

  public insert(entity: E): E {
    this.validateEntity(entity);

    try {
      this.collection.insertOne(entity);

      this.logger.debug("Repository done: insert", {
        entity,
      });

      return entity;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MnemosRepositoryError("Unable to insert entity", { error });
    }
  }

  public insertBulk(entities: Array<E>): Array<E> {
    return entities.map((entity) => this.insert(entity));
  }

  public save(entity: E): E {
    if (!this.exists({ id: entity.id })) {
      return this.insert(entity);
    }
    return this.update(entity);
  }

  public saveBulk(entities: Array<E>): Array<E> {
    return entities.map((entity) => this.save(entity));
  }

  public update(entity: E): E {
    this.validateEntity(entity);

    const predicate = this.createDefaultPredicate({ id: entity.id });

    if (!this.exists(predicate)) {
      throw new MnemosRepositoryError("Entity not found", {
        debug: { predicate },
      });
    }

    this.collection.update(predicate, entity);

    this.logger.debug("Repository done: update", {
      entity,
    });

    return entity;
  }

  public updateBulk(entities: Array<E>): Array<E> {
    return entities.map((entity) => this.update(entity));
  }

  public ttl(predicate: Predicate<E>): number {
    const [entity] = this.filter(predicate);

    this.logger.debug("Repository done: ttl", {
      predicate,
      entity,
    });

    if (!entity) {
      throw new MnemosRepositoryError("Entity not found", { debug: { predicate } });
    }

    if (!entity.expiresAt) {
      throw new MnemosRepositoryError("Entity does not have ttl", {
        debug: { predicate },
      });
    }

    return Math.round((entity.expiresAt.getTime() - Date.now()) / 1000);
  }

  public ttlById(id: string): number {
    return this.ttl({ id });
  }

  // private

  private createDefaultPredicate(predicate: Predicate<E> = {}): Predicate<E> {
    return {
      deletedAt: null,
      // $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      ...predicate,
    };
  }

  private filter(predicate: Predicate<E>): Array<E> {
    return this.collection.filter(this.createDefaultPredicate(predicate));
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
