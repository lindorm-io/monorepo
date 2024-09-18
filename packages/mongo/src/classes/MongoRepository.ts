import { snakeCase } from "@lindorm/case";
import { isFunction } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { randomUUID } from "crypto";
import {
  CountDocumentsOptions,
  DeleteOptions,
  Filter,
  FindOptions,
  UpdateOptions,
} from "mongodb";
import { z } from "zod";
import { MongoRepositoryError } from "../errors";
import { IMongoEntity, IMongoRepository } from "../interfaces";
import { MongoRepositoryOptions, ValidateMongoEntityFn } from "../types";
import { MongoEntityConfig } from "../types/mongo-entity-config";
import { MongoBase } from "./MongoBase";

export class MongoRepository<
    E extends IMongoEntity,
    O extends DeepPartial<E> = DeepPartial<E>,
  >
  extends MongoBase<E>
  implements IMongoRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly config: MongoEntityConfig;
  private readonly validate: ValidateMongoEntityFn<E> | undefined;

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
        {
          index: { id: 1, revision: 1 },
        },
        ...(options.config?.useSoftDelete
          ? [
              {
                index: { id: 1, deletedAt: 1 },
                nullable: ["deletedAt"],
              },
              {
                index: { id: 1, revision: 1, deletedAt: 1 },
                nullable: ["deletedAt"],
              },
            ]
          : []),
        ...(options.config?.useExpiry
          ? [
              {
                index: { id: 1, deletedAt: 1, expiresAt: 1 },
                nullable: ["deletedAt", "expiresAt"],
              },
              {
                index: { id: 1, revision: 1, deletedAt: 1, expiresAt: 1 },
                nullable: ["deletedAt", "expiresAt"],
              },
            ]
          : []),
        ...(options.indexes ?? []),
      ],
    });

    this.logger = options.logger.child(["MongoRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
    this.config = options.config ?? {};
    this.validate = options.validate;
  }

  // public sync

  public create(options: O | E = {} as O): E {
    const entity = new this.EntityConstructor(options);

    entity.id = (options.id as string) ?? entity.id ?? randomUUID();
    entity.revision = (options.revision as number) ?? entity.revision ?? 0;
    entity.createdAt = (options.createdAt as Date) ?? entity.createdAt ?? new Date();
    entity.updatedAt = (options.updatedAt as Date) ?? entity.updatedAt ?? new Date();
    entity.deletedAt = (options.deletedAt as Date) ?? (entity.deletedAt as Date) ?? null;
    entity.expiresAt = (options.expiresAt as Date) ?? (entity.expiresAt as Date) ?? null;

    this.logger.debug("Created entity", { entity });

    return entity;
  }

  // public async

  public async count(
    criteria: Filter<E> = {},
    options: CountDocumentsOptions = {},
  ): Promise<number> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria);

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
          time: Date.now() - start,
        },
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
        result: {
          ...result,
          time: Date.now() - start,
        },
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
        result: {
          ...result,
          time: Date.now() - start,
        },
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to remove entity", { error });
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

    const filter = this.createDefaultFilter(criteria);

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
          time: Date.now() - start,
        },
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

    const filter = this.createDefaultFilter(criteria);

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
          time: Date.now() - start,
        },
      });

      return documents.map((document) => this.create(document));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entities", { error });
    }
  }

  public async findOne(criteria: Filter<E>, options?: FindOptions<E>): Promise<E | null> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria);

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
          time: Date.now() - start,
        },
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

    try {
      const result = await this.collection.insertOne(updated);

      this.logger.debug("Repository done: insert", {
        input: {
          entity,
        },
        result: {
          acknowledged: result.acknowledged,
          time: Date.now() - start,
        },
      });

      return updated;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<E>): Promise<Array<E>> {
    const start = Date.now();

    for (const entity of entities) {
      this.validateEntity(entity);
    }

    const updated = entities.map((entity) => this.updateEntityData(entity));

    try {
      const result = await this.collection.insertMany(updated);

      this.logger.debug("Repository done: insertBulk", {
        input: {
          count: entities.length,
        },
        result: {
          acknowledged: result.acknowledged,
          insertedCount: result.insertedCount,
          time: Date.now() - start,
        },
      });

      return updated.map((entity) => this.create(entity));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to insert entities", { error });
    }
  }

  public async save(entity: E): Promise<E> {
    return await this.updateEntity(entity, { upsert: true });
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(
      entities.map((entity) => this.updateEntity(entity, { upsert: true })),
    );
  }

  public async softDelete(criteria: Filter<E>, options?: DeleteOptions): Promise<void> {
    if (!this.config.useSoftDelete) {
      throw new MongoRepositoryError("Soft delete is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    const deletedAt = new Date();

    try {
      const result = await this.collection.updateMany(
        criteria,
        { $set: { deletedAt } as any },
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
          time: Date.now() - start,
        },
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to soft delete entities", { error });
    }
  }

  public async softDeleteById(id: string): Promise<void> {
    if (!this.config.useSoftDelete) {
      throw new MongoRepositoryError("Soft delete is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    const deletedAt = new Date();
    const criteria: Filter<any> = { id };

    try {
      const result = await this.collection.updateOne(criteria, {
        $set: { deletedAt } as any,
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
          time: Date.now() - start,
        },
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
    return await this.updateEntity(entity);
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.updateEntity(entity)));
  }

  public async ttl(criteria: Filter<E>): Promise<number> {
    if (!this.config.useExpiry) {
      throw new MongoRepositoryError("Expiry is not enabled", {
        debug: { config: this.config },
      });
    }

    const start = Date.now();

    try {
      const document = await this.collection.findOne(criteria, {
        projection: { expiresAt: 1 },
      });

      this.logger.debug("Repository done: ttl", {
        input: {
          criteria,
        },
        result: {
          document,
          time: Date.now() - start,
        },
      });

      if (!document) {
        throw new MongoRepositoryError("Entity not found", { debug: { criteria } });
      }

      if (!document.expiresAt) {
        throw new MongoRepositoryError("Entity does not have ttl", {
          debug: { criteria },
        });
      }

      return Math.round((document.expiresAt.getTime() - Date.now()) / 1000);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to establish ttl for entity", { error });
    }
  }

  public async ttlById(id: string): Promise<number> {
    return this.ttl({ id } as any);
  }

  // private

  private static createCollectionName<E extends IMongoEntity>(
    options: MongoRepositoryOptions<E>,
  ): string {
    const nsp = options.namespace ? `${snakeCase(options.namespace)}_` : "";
    const name = `${snakeCase(options.Entity.name)}`;

    return `${nsp}${name}`;
  }

  private createDefaultFilter(criteria: Filter<any> = {}): Filter<any> {
    return {
      ...(this.config.useSoftDelete ? { deletedAt: { $eq: null } } : {}),
      ...(this.config.useExpiry
        ? { $or: [{ expiresAt: { $eq: null } }, { expiresAt: { $gt: new Date() } }] }
        : {}),
      ...criteria,
    };
  }

  private createUpdateFilter(entity: E, criteria: Filter<E> = {}): Filter<any> {
    const { id, revision } = entity;

    return {
      id: { $eq: id },
      revision: { $eq: revision },
      ...(this.config.useSoftDelete ? { deletedAt: { $eq: null } } : {}),
      ...(this.config.useExpiry
        ? { $or: [{ expiresAt: { $eq: null } }, { expiresAt: { $gt: new Date() } }] }
        : {}),
      ...criteria,
    };
  }

  private updateEntityData(entity: E): E {
    const updated = this.create(entity);

    updated.revision = entity.revision + 1;
    updated.updatedAt = new Date();

    return updated;
  }

  private async updateEntity(entity: E, options?: UpdateOptions): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    const filter = this.createUpdateFilter(entity);
    const updated = this.updateEntityData(entity);

    try {
      const result = await this.collection.updateOne(
        filter,
        { $set: updated as any },
        options,
      );

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
          time: Date.now() - start,
        },
      });

      if (result.modifiedCount !== 1 && result.upsertedCount !== 1) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter, result },
        });
      }

      return updated;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to update entity", { error });
    }
  }

  private validateBaseEntity(entity: E): void {
    z.object({
      id: z.string().uuid(),
      revision: z.number().int().min(0),
      createdAt: z.date(),
      updatedAt: z.date(),
      deletedAt: z.date().nullable(),
      expiresAt: z.date().nullable(),
    }).parse({
      id: entity.id,
      revision: entity.revision,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      expiresAt: entity.expiresAt,
    });
  }

  private validateEntity(entity: E): void {
    this.validateBaseEntity(entity);

    if (isFunction(this.validate)) {
      const { id, revision, createdAt, updatedAt, deletedAt, expiresAt, ...rest } =
        entity;
      this.validate(rest);
    }
  }
}
