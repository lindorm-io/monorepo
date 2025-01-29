import { snakeCase } from "@lindorm/case";
import { IEntityBase } from "@lindorm/entity";
import { isDate, isFunction, isNumber } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { randomUUID } from "crypto";
import { CountDocumentsOptions, DeleteOptions, Filter, FindOptions } from "mongodb";
import { z } from "zod";
import { MongoRepositoryError } from "../errors";
import { IMongoRepository } from "../interfaces";
import {
  CreateMongoEntityFn,
  MongoEntityConfig,
  MongoRepositoryOptions,
  ValidateMongoEntityFn,
} from "../types";
import { MongoBase } from "./MongoBase";

export class MongoRepository<
    E extends IEntityBase,
    O extends DeepPartial<E> = DeepPartial<E>,
  >
  extends MongoBase<E>
  implements IMongoRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly config: MongoEntityConfig<E>;
  private readonly createFn: CreateMongoEntityFn<E> | undefined;
  private readonly validateFn: ValidateMongoEntityFn<E> | undefined;

  protected readonly logger: ILogger;

  public constructor(options: MongoRepositoryOptions<E>) {
    super({
      client: options.client,
      collectionName: MongoRepository.createCollectionName(options),
      databaseName: options.database,
      logger: options.logger,
      indexes: [
        {
          index: { id: 1 },
          unique: true,
        },
        ...(options.config?.revisionAttribute
          ? [
              {
                index: {
                  id: 1,
                  [options.config.revisionAttribute as any]: 1,
                },
                finite: [options.config.revisionAttribute],
                unique: true,
              },
            ]
          : []),
        ...(options.config?.sequenceAttribute
          ? [
              {
                index: {
                  [options.config.sequenceAttribute as any]: 1,
                },
                finite: [options.config.sequenceAttribute],
                unique: true,
              },
            ]
          : []),
        ...(options.config?.deleteAttribute
          ? [
              {
                index: {
                  id: 1,
                  [options.config.deleteAttribute]: 1,
                },
                nullable: [options.config.deleteAttribute],
              },
            ]
          : []),
        ...(options.config?.deleteAttribute && options.config?.revisionAttribute
          ? [
              {
                index: {
                  id: 1,
                  [options.config.revisionAttribute]: 1,
                  [options.config.deleteAttribute]: 1,
                },
                nullable: [options.config.deleteAttribute],
              },
            ]
          : []),
        ...(options.config?.deleteAttribute && options.config?.ttlAttribute
          ? [
              {
                index: {
                  id: 1,
                  [options.config.deleteAttribute]: 1,
                  [options.config.ttlAttribute]: 1,
                },
                nullable: [options.config.deleteAttribute, options.config.ttlAttribute],
              },
            ]
          : []),
        ...(options.config?.deleteAttribute &&
        options.config?.revisionAttribute &&
        options.config?.ttlAttribute
          ? [
              {
                index: {
                  id: 1,
                  [options.config.revisionAttribute]: 1,
                  [options.config.deleteAttribute]: 1,
                  [options.config.ttlAttribute]: 1,
                },
                nullable: [options.config.deleteAttribute, options.config.ttlAttribute],
              },
            ]
          : []),
        ...(options.indexes ?? []),
      ],
    });

    this.logger = options.logger.child(["MongoRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
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

  public create(options: O | E = {} as O): E {
    const entity = this.createFn
      ? this.createFn(options)
      : MongoRepository.createEntity(this.EntityConstructor, options);

    if (
      this.config.revisionAttribute &&
      !isNumber(entity[this.config.revisionAttribute])
    ) {
      entity[this.config.revisionAttribute] = 0 as any;
    }

    if (
      this.config.sequenceAttribute &&
      !isNumber(entity[this.config.sequenceAttribute])
    ) {
      entity[this.config.sequenceAttribute] = 0 as any;
    }

    this.logger.silly("Created entity", { entity });

    this.validateEntity(entity);

    return entity;
  }

  public async count(
    criteria: Filter<E> = {},
    options: CountDocumentsOptions = {},
  ): Promise<number> {
    const start = Date.now();

    const filter = this.defaultFindFilter(criteria);

    try {
      const count = await this.collection.countDocuments(filter, options);

      this.logger.debug("Repository done: count", {
        input: {
          criteria,
          filter,
          options,
        },
        result: {
          count,
        },
        time: Date.now() - start,
      });

      return count;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to count entities", { error });
    }
  }

  public async delete(criteria: Filter<E>, options?: DeleteOptions): Promise<void> {
    const start = Date.now();

    try {
      const result = await this.collection.deleteMany(criteria, options);

      this.logger.debug("Repository done: delete", {
        input: {
          criteria,
        },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to delete entities", { error });
    }
  }

  public async deleteById(id: string): Promise<void> {
    const start = Date.now();

    const filter: Filter<any> = { id };

    try {
      const result = await this.collection.deleteOne(filter);

      this.logger.debug("Repository done: deleteById", {
        input: {
          filter: { id },
        },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to remove entity", { error });
    }
  }

  public async deleteExpired(): Promise<void> {
    const start = Date.now();

    if (!this.config.ttlAttribute) {
      throw new MongoRepositoryError("TTL is not enabled", {
        debug: { config: this.config },
      });
    }

    const filter: Filter<any> = {
      [this.config.ttlAttribute]: { $lt: new Date() },
    };

    try {
      const result = await this.collection.deleteMany(filter);

      this.logger.debug("Repository done: deleteExpired", {
        input: {
          filter,
        },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to delete expired entities", { error });
    }
  }

  public async destroy(entity: E): Promise<void> {
    await this.deleteById(entity.id);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(criteria: Filter<E>, options?: FindOptions<E>): Promise<boolean> {
    const start = Date.now();

    const filter = this.defaultFindFilter(criteria);

    try {
      const count = await this.count(filter, { limit: 1, ...options });
      const exists = count >= 1;

      this.logger.debug("Repository done: exists", {
        input: {
          criteria,
          options,
        },
        result: {
          exists,
        },
        time: Date.now() - start,
      });

      if (count > 1) {
        this.logger.warn("Multiple documents found", {
          input: {
            criteria,
            options,
          },
          result: {
            count,
          },
        });
      }

      return exists;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to establish existence of entity", {
        error,
      });
    }
  }

  public async find(criteria?: Filter<E>, options?: FindOptions<E>): Promise<Array<E>> {
    const start = Date.now();

    const filter = this.defaultFindFilter(criteria);

    try {
      const documents = await this.collection.find(filter, options).toArray();

      this.logger.debug("Repository done: find", {
        input: {
          criteria,
          filter,
          options,
        },
        result: {
          count: documents.length,
        },
        time: Date.now() - start,
      });

      return documents.map((document) => this.create(document));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entities", { error });
    }
  }

  public async findOne(criteria: Filter<E>, options?: FindOptions<E>): Promise<E | null> {
    const start = Date.now();

    const filter = this.defaultFindFilter(criteria);

    try {
      const document = await this.collection.findOne(filter, options);

      this.logger.debug("Repository done: findOne", {
        input: {
          criteria,
          filter,
          options,
        },
        result: {
          document,
        },
        time: Date.now() - start,
      });

      if (!document) return null;

      return this.create(document);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entity", { error });
    }
  }

  public async findOneOrFail(criteria: Filter<E>, options?: FindOptions<E>): Promise<E> {
    const entity = await this.findOne(criteria, options);

    if (!entity) {
      throw new MongoRepositoryError("Entity not found", {
        debug: { criteria, options },
      });
    }

    return entity;
  }

  public async findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E> {
    const entity = await this.findOne(criteria as any);
    if (entity) return entity;

    return this.insert(this.create({ ...criteria, ...options } as O));
  }

  public async findOneById(id: string): Promise<E | null> {
    return this.findOne({ id } as any);
  }

  public async findOneByIdOrFail(id: string): Promise<E> {
    return this.findOneOrFail({ id } as any);
  }

  public async insert(entity: E): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    const updated = this.updateEntityData(entity);

    if (this.config.sequenceAttribute) {
      (updated[this.config.sequenceAttribute] as number) = await this.getNextSequence();
    }

    try {
      const result = await this.collection.insertOne(updated);

      this.logger.debug("Repository done: insert", {
        input: {
          entity,
        },
        result: {
          acknowledged: result.acknowledged,
        },
        time: Date.now() - start,
      });

      return this.create(updated);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.insert(entity)));
  }

  public async save(entity: E): Promise<E> {
    if (this.config.revisionAttribute) {
      if (entity[this.config.revisionAttribute] === 0) {
        return this.insert(entity);
      }
      return this.update(entity);
    }

    try {
      return this.insert(entity);
    } catch (_) {
      return this.update(entity);
    }
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async softDelete(criteria: Filter<E>, options?: DeleteOptions): Promise<void> {
    if (!this.config.deleteAttribute) {
      throw new MongoRepositoryError("Soft delete is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    try {
      const result = await this.collection.updateMany(
        criteria,
        { $set: { [this.config.deleteAttribute]: new Date() } },
        options,
      );

      this.logger.debug("Repository done: softDelete", {
        input: {
          criteria,
        },
        result: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
        },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to soft delete entities", { error });
    }
  }

  public async softDeleteById(id: string): Promise<void> {
    if (!this.config.deleteAttribute) {
      throw new MongoRepositoryError("Soft delete is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    const criteria: Filter<any> = { id };

    try {
      const result = await this.collection.updateOne(criteria, {
        $set: { [this.config.deleteAttribute]: new Date() },
      });

      this.logger.debug("Repository done: softDeleteById", {
        input: {
          filter: { id },
        },
        result: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
        },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to soft delete entity", { error });
    }
  }

  public async softDestroy(entity: E): Promise<void> {
    await this.softDeleteById(entity.id);
  }

  public async softDestroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.softDestroy(entity)));
  }

  public async update(entity: E): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    const filter = this.defaultUpdateFilter(entity);
    const updated = this.updateEntityData(entity);

    try {
      const result = await this.collection.updateOne(filter, { $set: updated as any });

      this.logger.debug("Repository done: updateEntity", {
        input: {
          filter,
          updated,
        },
        result: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
        },
        time: Date.now() - start,
      });

      if (result.modifiedCount !== 1 && result.upsertedCount !== 1) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter, result },
        });
      }

      return this.create(updated);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to update entity", { error });
    }
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.update(entity)));
  }

  public async ttl(criteria: Filter<E>): Promise<number> {
    if (!this.config.ttlAttribute) {
      throw new MongoRepositoryError("TTL is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    try {
      const document = await this.collection.findOne(criteria, {
        projection: { [this.config.ttlAttribute]: 1 },
      });

      this.logger.debug("Repository done: ttl", {
        input: {
          criteria,
        },
        result: {
          document,
        },
        time: Date.now() - start,
      });

      if (!document) {
        throw new MongoRepositoryError("Entity not found", { debug: { criteria } });
      }

      if (!isDate(document[this.config.ttlAttribute])) {
        throw new MongoRepositoryError("Entity does not have ttl", {
          debug: { document },
        });
      }

      return Math.round(
        (document[this.config.ttlAttribute].getTime() - Date.now()) / 1000,
      );
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to establish ttl for entity", { error });
    }
  }

  public async ttlById(id: string): Promise<number> {
    return this.ttl({ id } as any);
  }

  // private static

  private static createCollectionName<E extends IEntityBase>(
    options: MongoRepositoryOptions<E>,
  ): string {
    const nsp = options.namespace ? `${snakeCase(options.namespace)}_` : "";
    const name = `${snakeCase(options.Entity.name)}`;

    return `${nsp}${name}`;
  }

  // private

  private defaultFindFilter(criteria: Filter<any> = {}): Filter<any> {
    return {
      ...(this.config.deleteAttribute
        ? { [this.config.deleteAttribute]: { $eq: null } }
        : {}),
      ...(this.config.ttlAttribute
        ? {
            $or: [
              { [this.config.ttlAttribute]: { $eq: null } },
              { [this.config.ttlAttribute]: { $gt: new Date() } },
            ],
          }
        : {}),
      ...criteria,
    };
  }

  private defaultUpdateFilter(entity: E): Filter<any> {
    const { id } = entity;

    return {
      id: { $eq: id },
      ...(this.config.revisionAttribute
        ? {
            [this.config.revisionAttribute]: {
              $eq: entity[this.config.revisionAttribute],
            },
          }
        : {}),
      ...(this.config.deleteAttribute
        ? { [this.config.deleteAttribute]: { $eq: null } }
        : {}),
      ...(this.config.ttlAttribute
        ? {
            $or: [
              { [this.config.ttlAttribute]: { $eq: null } },
              { [this.config.ttlAttribute]: { $gt: new Date() } },
            ],
          }
        : {}),
    };
  }

  private async getNextSequence(): Promise<number> {
    const start = Date.now();

    try {
      const document = await this.database.collection("_counters").findOneAndUpdate(
        {
          collection: this.collectionName,
        },
        {
          $inc: { seq: 1 },
        },
        {
          returnDocument: "after",
          upsert: true,
        },
      );

      this.logger.silly("Repository done: getNextSequence", {
        result: {
          document,
        },
        time: Date.now() - start,
      });

      if (!document) {
        throw new MongoRepositoryError("Unable to get next sequence", {
          debug: { collection: this.collectionName, result: document },
        });
      }

      return document.seq;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to get next sequence", { error });
    }
  }

  private updateEntityData(entity: E): E {
    const updated = this.create(entity);

    if (this.config.revisionAttribute) {
      (updated[this.config.revisionAttribute] as number) =
        (entity[this.config.revisionAttribute] as number) + 1;
    }

    updated.updatedAt = new Date();

    return updated;
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
