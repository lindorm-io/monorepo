import {
  EntityKit,
  EntityMetadata,
  getCollectionName,
  globalEntityMetadata,
  IEntity,
  MetaSource,
} from "@lindorm/entity";
import { isDate } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { DeepPartial } from "@lindorm/types";
import { CountDocumentsOptions, DeleteOptions, Filter } from "mongodb";
import { MongoRepositoryError } from "../errors";
import { IMongoRepository } from "../interfaces";
import { FindOptions, MongoRepositoryOptions } from "../types";
import { getIndexOptions } from "../utils/private";
import { MongoBase } from "./MongoBase";

const PRIMARY_SOURCE: MetaSource = "mongo" as const;

export class MongoRepository<E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>
  extends MongoBase<E>
  implements IMongoRepository<E, O>
{
  protected readonly logger: ILogger;

  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly metadata: EntityMetadata;

  public constructor(options: MongoRepositoryOptions<E>) {
    const metadata = globalEntityMetadata.get(options.Entity);
    const database = metadata.entity.database || options.database;

    if (!database) {
      throw new MongoRepositoryError("Database name not found", {
        debug: {
          metadata,
          options: { Entity: options.Entity, database: options.database },
        },
      });
    }

    super({
      client: options.client,
      collection: getCollectionName(options.Entity, options),
      database,
      logger: options.logger,
      indexes: getIndexOptions(metadata),
    });

    this.logger = options.logger.child(["MongoRepository", options.Entity.name]);

    this.kit = new EntityKit({
      Entity: options.Entity,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.metadata = metadata;
    this.incrementName = this.kit.getIncrementName(options);

    if (
      this.metadata.columns.find((c) => c.decorator === "VersionKeyColumn") &&
      this.metadata.columns.find((c) => c.decorator === "Column" && c.readonly)
    ) {
      this.logger.warn(
        "Versioned entities with readonly @Column() are not supported. Mongo will not be able to handle readonly filtering automatically. Make sure to handle this manually.",
      );
    }

    if (this.metadata.relations.length > 0) {
      this.logger.warn(
        "This version of @lindorm/mongo does not support relations. Make sure to handle this manually or keep your eye open for updates.",
      );
    }
  }

  // public

  public create(options?: O | E): E {
    return this.kit.create(options);
  }

  public copy(entity: E): E {
    return this.kit.copy(entity);
  }

  public validate(entity: E): void {
    return this.kit.validate(entity);
  }

  public async clone(entity: E): Promise<E> {
    const start = Date.now();

    const clone = await this.kit.clone(entity);

    this.validate(clone);

    try {
      const result = await this.collection.insertOne(clone);

      this.logger.debug("Repository done: clone", {
        input: { entity: clone },
        result: { acknowledged: result.acknowledged },
        time: Date.now() - start,
      });

      const copy = this.copy(clone);

      this.kit.onInsert(copy);

      return copy;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entity", { error });
    }
  }

  public async cloneBulk(entities: Array<E>): Promise<Array<E>> {
    const start = Date.now();

    const clones: Array<E> = [];

    for (const entity of entities) {
      clones.push(await this.kit.clone(entity));
    }

    for (const clone of clones) {
      this.validate(clone);
    }

    try {
      const result = await this.collection.insertMany(clones);

      this.logger.debug("Repository done: insertBulk", {
        input: { entities: clones },
        result: {
          acknowledged: result.acknowledged,
          insertedCount: result.insertedCount,
        },
        time: Date.now() - start,
      });

      const copies = clones.map((entity) => this.copy(entity));

      for (const copy of copies) {
        this.kit.onInsert(copy);
      }

      return copies;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entities", { error });
    }
  }

  public async count(
    criteria: Filter<E> = {},
    options: CountDocumentsOptions = {},
  ): Promise<number> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const count = await this.collection.countDocuments(filter, options);

      this.logger.debug("Repository done: count", {
        input: { criteria, filter, options },
        result: { count },
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
        input: { criteria, options },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to delete entities", { error });
    }
  }

  public async deleteExpired(): Promise<void> {
    const start = Date.now();

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (!expiryDate) {
      throw new MongoRepositoryError("ExpiryDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    const filter: Filter<any> = { [expiryDate.key]: { $lt: new Date() } };

    try {
      const result = await this.collection.deleteMany(filter);

      this.logger.debug("Repository done: deleteExpired", {
        input: { filter },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to delete expired entities", { error });
    }
  }

  public async destroy(entity: E): Promise<void> {
    await this.delete(this.createPrimaryFilter(entity));

    this.kit.onDestroy(entity);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(criteria: Filter<E>, options?: FindOptions<E>): Promise<boolean> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const count = await this.count(filter, { limit: 1, ...options });
      const exists = count >= 1;

      this.logger.debug("Repository done: exists", {
        input: { criteria, options },
        result: { exists },
        time: Date.now() - start,
      });

      if (count > 1) {
        this.logger.warn("Multiple documents found", {
          input: { criteria, options },
          result: { count },
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

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const documents = await this.collection.find(filter, options).toArray();

      this.logger.debug("Repository done: find", {
        input: { criteria, filter, options },
        result: { count: documents.length },
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

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const document = await this.collection.findOne(filter, options);

      this.logger.debug("Repository done: findOne", {
        input: { criteria, filter, options },
        result: { document },
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

  public async insert(entity: E): Promise<E> {
    const start = Date.now();

    this.validate(entity);

    const insert = await this.kit.insert(entity);

    try {
      const result = await this.collection.insertOne(insert);

      this.logger.debug("Repository done: insert", {
        input: { entity: insert },
        result: { acknowledged: result.acknowledged },
        time: Date.now() - start,
      });

      const copy = this.copy(insert);

      this.kit.onInsert(copy);

      return copy;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<E>): Promise<Array<E>> {
    const start = Date.now();

    const inserts: Array<E> = [];

    for (const entity of entities) {
      inserts.push(await this.kit.insert(entity));
    }

    for (const entity of inserts) {
      this.validate(entity);
    }

    try {
      const result = await this.collection.insertMany(inserts);

      this.logger.debug("Repository done: insertBulk", {
        input: { entities: inserts },
        result: {
          acknowledged: result.acknowledged,
          insertedCount: result.insertedCount,
        },
        time: Date.now() - start,
      });

      const copies = inserts.map((entity) => this.copy(entity));

      for (const copy of copies) {
        this.kit.onInsert(copy);
      }

      return copies;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entities", { error });
    }
  }

  public async save(entity: E): Promise<E> {
    switch (this.kit.getSaveStrategy(entity)) {
      case "insert":
        return await this.insert(entity);
      case "update":
        return await this.update(entity);
      default:
        break;
    }

    try {
      return this.insert(entity);
    } catch (err: any) {
      if (err.code === 11000) {
        return this.update(entity);
      }
      throw err;
    }
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async softDelete(criteria: Filter<E>, options?: DeleteOptions): Promise<void> {
    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (!deleteDate) {
      throw new MongoRepositoryError("DeleteDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    const start = Date.now();

    try {
      const result = await this.collection.updateMany(
        criteria,
        { $set: { [deleteDate.key]: new Date() } },
        options,
      );

      this.logger.debug("Repository done: softDelete", {
        input: { criteria },
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

  public async softDestroy(entity: E): Promise<void> {
    await this.softDelete(this.createPrimaryFilter(entity));
  }

  public async softDestroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.softDestroy(entity)));
  }

  public async ttl(criteria: Filter<E>): Promise<number> {
    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );

    if (!expiryDate) {
      throw new MongoRepositoryError("ExpiryDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    const start = Date.now();

    try {
      const document = await this.collection.findOne(this.createDefaultFilter(criteria), {
        projection: { [expiryDate.key]: 1 },
      });

      this.logger.debug("Repository done: ttl", {
        input: { criteria },
        result: { document },
        time: Date.now() - start,
      });

      if (!document) {
        throw new MongoRepositoryError("Entity not found", { debug: { criteria } });
      }

      if (!isDate(document[expiryDate.key])) {
        throw new MongoRepositoryError("Entity does not have ttl", {
          debug: { document },
        });
      }

      return Math.round((document[expiryDate.key].getTime() - Date.now()) / 1000);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to establish ttl for entity", { error });
    }
  }

  public async update(entity: E): Promise<E> {
    this.validate(entity);

    let update: E;

    if (this.kit.updateStrategy === "version") {
      update = await this.updateEntityVersion(entity);
    } else {
      update = await this.updateEntityDefault(entity);
    }

    this.kit.onUpdate(update);

    return update;
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.update(entity)));
  }

  public async updateMany(criteria: Filter<E>, update: DeepPartial<E>): Promise<void> {
    const start = Date.now();

    this.kit.verifyReadonly(update);

    if (this.kit.updateStrategy === "version") {
      throw new MongoRepositoryError("updateMany not supported with versioned entities");
    }

    const updateDate = this.metadata.columns.find(
      (c) => c.decorator === "UpdateDateColumn",
    );
    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");

    if (updateDate) {
      (update as any)[updateDate.key] = new Date();
    }

    try {
      const result = await this.collection.updateMany(criteria, {
        $set: update as any,
        ...(version ? { $inc: { [version.key]: 1 } } : {}),
      });

      if (!result.modifiedCount && !result.upsertedCount) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter: criteria, result },
        });
      }

      this.logger.debug("Repository done: update", {
        input: { filter: criteria, update },
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
      throw new MongoRepositoryError("Unable to update many entities", { error });
    }
  }

  public async versions(
    criteria: Filter<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    const start = Date.now();

    const filter = this.createFindVersionsFilter(criteria);

    try {
      const documents = await this.collection.find(filter, options).toArray();

      this.logger.debug("Repository done: versions", {
        input: { criteria, filter },
        result: { count: documents.length },
        time: Date.now() - start,
      });

      return documents.map((document) => this.create(document));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entity versions", { error });
    }
  }

  // private update

  private async updateEntityDefault(entity: E): Promise<E> {
    const start = Date.now();

    const filter = this.createUpdateFilter(entity);
    const update = this.kit.update(entity);
    const set = this.kit.removeReadonly(update);

    try {
      const result = await this.collection.updateOne(filter, { $set: set });

      if (result.modifiedCount !== 1 && result.upsertedCount !== 1) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter, result },
        });
      }

      this.logger.debug("Repository done: update", {
        input: { filter, update, set },
        result: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
        },
        time: Date.now() - start,
      });

      return update;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to update entity", { error });
    }
  }

  private async updateEntityVersion(entity: E): Promise<E> {
    const start = Date.now();

    const filter = this.createUpdateFilter(entity);
    const partial = this.kit.versionUpdate(entity);
    const insert = this.kit.versionCopy(partial, entity);

    try {
      const updateResult = await this.collection.updateOne(filter, {
        $set: partial as any,
      });

      if (updateResult.modifiedCount !== 1 && updateResult.upsertedCount !== 1) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter, result: updateResult },
        });
      }

      const insertResult = await this.collection.insertOne(insert);

      this.logger.debug("Repository done: update", {
        input: { entity: insert },
        result: {
          acknowledged: insertResult.acknowledged && updateResult.acknowledged,
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          upsertedCount: updateResult.upsertedCount,
        },
        time: Date.now() - start,
      });

      return this.copy(insert);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to update entity", { error });
    }
  }

  // private

  private createPrimaryFilter(entity: E): Filter<E> {
    const result: Filter<any> = {};

    for (const key of this.metadata.primaryKeys) {
      result[key] = entity[key];
    }

    return result;
  }

  private createDefaultFilter(
    criteria: Filter<E> = {},
    options: FindOptions<E> = {},
  ): Filter<E> {
    const result: Filter<any> = { ...criteria };

    const versionDate = options.versionTimestamp ?? new Date();

    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (deleteDate) {
      result[deleteDate.key] = { $eq: null };
    }

    const versionStartDate = this.metadata.columns.find(
      (c) => c.decorator === "VersionStartDateColumn",
    );
    if (versionStartDate) {
      result[versionStartDate.key] = { $lte: versionDate };
    }

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    const versionEndDate = this.metadata.columns.find(
      (c) => c.decorator === "VersionEndDateColumn",
    );
    if (expiryDate && versionEndDate) {
      result["$or"] = [
        { [expiryDate.key]: null, [versionEndDate.key]: null },
        { [expiryDate.key]: { $gt: new Date() }, [versionEndDate.key]: null },
        { [expiryDate.key]: null, [versionEndDate.key]: { $gt: versionDate } },
        {
          [expiryDate.key]: { $gt: new Date() },
          [versionEndDate.key]: { $gt: versionDate },
        },
      ];
    } else if (expiryDate) {
      result["$or"] = [
        { [expiryDate.key]: null },
        { [expiryDate.key]: { $gt: new Date() } },
      ];
    }

    return result;
  }

  private createUpdateFilter(entity: E): Filter<E> {
    const result: Filter<any> = this.createPrimaryFilter(entity);

    if (!this.kit.isPrimarySource) {
      this.logger.debug("Skipping update filter for non-primary source", {
        source: this.metadata.primarySource,
      });
      return result;
    }

    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (deleteDate) {
      result[deleteDate.key] = { $eq: null };
    }

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (expiryDate) {
      result["$or"] = [
        { [expiryDate.key]: null },
        { [expiryDate.key]: { $gt: new Date() } },
      ];
    }

    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");
    if (version) {
      result[version.key] = { $eq: entity[version.key] };
    }

    return result;
  }

  private createFindVersionsFilter(criteria: Filter<E>): Filter<E> {
    const result: Filter<any> = { ...criteria };

    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (deleteDate) {
      result[deleteDate.key] = { $eq: null };
    }

    return result;
  }

  private async getNextIncrement(key: string): Promise<number> {
    const start = Date.now();

    try {
      const document = await this.database
        .collection(this.incrementName)
        .findOneAndUpdate(
          { key },
          { $inc: { value: 1 } },
          { returnDocument: "after", upsert: true },
        );

      this.logger.silly("Repository done: getNextIncrement", {
        result: {
          collection: this.collectionName,
          increment: this.incrementName,
          document,
        },
        time: Date.now() - start,
      });

      if (!document) {
        throw new MongoRepositoryError("Unable to get next increment", {
          debug: {
            collection: this.collectionName,
            increment: this.incrementName,
            result: document,
          },
        });
      }

      return document.value;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to get next increment", { error });
    }
  }
}
