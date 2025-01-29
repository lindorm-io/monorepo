import { IEntityBase } from "@lindorm/entity";
import { isDate, isFunction } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MnemosRepositoryError } from "../errors";
import { IMnemosCollection, IMnemosRepository } from "../interfaces";
import {
  CreateMnemosEntityFn,
  MnemosEntityConfig,
  MnemosRepositoryOptions,
  ValidateMnemosEntityFn,
} from "../types";

export class MnemosRepository<
  E extends IEntityBase,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IMnemosRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly collection: IMnemosCollection<E>;
  private readonly config: MnemosEntityConfig<E>;
  private readonly logger: ILogger;
  private readonly createFn: CreateMnemosEntityFn<E> | undefined;
  private readonly validateFn: ValidateMnemosEntityFn<E> | undefined;

  public constructor(options: MnemosRepositoryOptions<E>) {
    this.logger = options.logger.child(["MnemosRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
    this.collection = options.cache.collection(options.Entity.name, options);
    this.config = options.config ?? {};

    this.createFn = options.create;
    this.validateFn = options.validate;
  }
  // public static

  public static createEntity<
    E extends IEntityBase,
    O extends DeepPartial<E> = DeepPartial<E>,
  >(Entity: Constructor<E>, options: O | E): E {
    const entity = new Entity();

    const { id, createdAt, updatedAt, ...rest } = options as E;

    entity.id = id ?? entity.id ?? randomUUID();
    entity.createdAt = createdAt ?? entity.createdAt ?? new Date();
    entity.updatedAt = updatedAt ?? entity.updatedAt ?? new Date();

    for (const [key, value] of Object.entries(rest)) {
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
      : MnemosRepository.createEntity(this.EntityConstructor, options);

    this.validateEntity(entity);

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

    if (!this.config.ttlAttribute || !isDate(entity[this.config.ttlAttribute])) {
      throw new MnemosRepositoryError("Entity does not have ttl", {
        debug: { entity },
      });
    }

    return Math.round(
      ((entity[this.config.ttlAttribute] as Date).getTime() - Date.now()) / 1000,
    );
  }

  public ttlById(id: string): number {
    return this.ttl({ id });
  }

  // private

  private createDefaultPredicate(predicate: Predicate<E> = {}): Predicate<E> {
    return {
      ...predicate,
      ...(this.config.ttlAttribute && {
        $or: [
          { [this.config.ttlAttribute]: null },
          { [this.config.ttlAttribute]: { $gt: new Date() } },
        ],
      }),
    };
  }

  private filter(predicate: Predicate<E>): Array<E> {
    return this.collection.filter(this.createDefaultPredicate(predicate));
  }

  private validateBaseEntity(entity: E): void {
    z.object({
      id: z.string().uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }).parse({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private validateEntity(entity: E): void {
    this.validateBaseEntity(entity);

    if (isFunction(this.validateFn)) {
      const { id, createdAt, updatedAt, ...rest } = entity;

      this.validateFn(rest);
    }

    this.logger.silly("Entity validated", { entity });
  }
}
