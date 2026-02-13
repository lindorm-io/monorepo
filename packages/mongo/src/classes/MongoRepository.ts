import {
  EntityKit,
  EntityMetadata,
  getCollectionName,
  getJoinCollectionName,
  globalEntityMetadata,
  IEntity,
  MetaRelation,
  MetaSource,
} from "@lindorm/entity";
import { isDate } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Predicate } from "@lindorm/types";
import { Collection, Filter, FindCursor } from "mongodb";
import { MongoRepositoryError } from "../errors";
import { IMongoRepository } from "../interfaces";
import {
  CountDocumentsOptions,
  DeleteOptions,
  FindOptions,
  MongoRepositoryOptions,
} from "../types";
import { getIndexOptions, predicateToMongo } from "../utils/private";
import { MongoBase } from "./MongoBase";

const PRIMARY_SOURCE: MetaSource = "MongoSource" as const;

export class MongoRepository<E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>
  extends MongoBase<E>
  implements IMongoRepository<E, O>
{
  protected readonly logger: ILogger;

  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly metadata: EntityMetadata;
  private readonly parent: Constructor<E> | undefined;

  public constructor(options: MongoRepositoryOptions<E>) {
    const metadata = globalEntityMetadata.get(options.target);
    const database = metadata.entity.database || options.database;

    if (!database) {
      throw new MongoRepositoryError("Database name not found", {
        debug: {
          metadata,
          options: { Entity: options.target, database: options.database },
        },
      });
    }

    super({
      client: options.client,
      collection: getCollectionName(options.target, options),
      database,
      logger: options.logger,
      indexes: getIndexOptions(metadata),
    });

    this.logger = options.logger.child(["MongoRepository", options.target.name]);

    this.kit = new EntityKit({
      target: options.target,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.metadata = metadata;
    this.incrementName = this.kit.getIncrementName(options);
    this.parent = options.parent;

    if (
      this.metadata.columns.find((c) => c.decorator === "VersionKeyColumn") &&
      this.metadata.columns.find((c) => c.decorator === "Column" && c.readonly)
    ) {
      this.logger.warn(
        "Versioned entities with readonly @Column() are not supported. Mongo will not be able to handle readonly filtering automatically. Make sure to handle this manually.",
      );
    }
  }

  // public

  public async setup(): Promise<void> {
    await super.setup();
    await this.setupJoinCollectionIndexes();
  }

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
    criteria: Predicate<E> = {},
    options: CountDocumentsOptions<E> = {},
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

  public cursor(criteria?: Predicate<E>, options?: FindOptions<E>): FindCursor<E> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const cursor = this.collection.find(filter, options);

      this.logger.debug("Repository done: cursor", {
        input: { criteria, filter, options },
        time: Date.now() - start,
      });

      cursor.map<E>((doc) => this.create(doc));

      return cursor;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entities", { error });
    }
  }

  public async delete(criteria: Predicate<E>, options?: DeleteOptions<E>): Promise<void> {
    const start = Date.now();

    try {
      const entities = await this.find(criteria, options);

      for (const entity of entities) {
        await this.destroy(entity);
      }

      this.logger.debug("Repository done: delete", {
        input: { criteria, options },
        result: { count: entities.length },
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
    await this.destroyRelations(entity);
    await this.collection.deleteOne(this.createPrimaryFilter(entity));

    this.kit.onDestroy(entity);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<boolean> {
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

  public async find(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    const start = Date.now();

    const filter = this.createDefaultFilter(criteria, options);

    try {
      const documents = await this.collection.find(filter, options).toArray();

      this.logger.debug("Repository done: find", {
        input: { criteria, filter, options },
        result: { count: documents.length },
        time: Date.now() - start,
      });

      const result: Array<E> = [];

      for (const document of documents) {
        result.push(await this.loadRelations(document));
      }

      return result;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entities", { error });
    }
  }

  public async findOne(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E | null> {
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

      return await this.loadRelations(document);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to find entity", { error });
    }
  }

  public async findOneOrFail(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E> {
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

  public async insert(entity: O | E): Promise<E> {
    const start = Date.now();

    entity = entity instanceof this.kit.target ? entity : this.create(entity);

    try {
      const insert = await this.kit.insert(entity);

      this.validate(insert);

      const document = this.kit.document(insert);
      const result = await this.collection.insertOne(document);

      this.logger.debug("Repository done: insert", {
        input: { entity: insert },
        result: { acknowledged: result.acknowledged },
        time: Date.now() - start,
      });

      this.kit.onInsert(insert);

      await this.saveRelations(insert, "insert");

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Failed to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<O | E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.insert(entity)));
  }

  public async save(entity: O | E): Promise<E> {
    entity = entity instanceof this.kit.target ? entity : this.create(entity);

    switch (this.kit.getSaveStrategy(entity)) {
      case "insert":
        return await this.insert(entity);
      case "update":
        return await this.update(entity);
      default:
        break;
    }

    try {
      return await this.insert(entity);
    } catch (err: any) {
      if (err.code === 11000) {
        return this.update(entity);
      }
      throw err;
    }
  }

  public async saveBulk(entities: Array<O | E>): Promise<Array<E>> {
    return await Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async softDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions<E>,
  ): Promise<void> {
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
        this.combineFilter(criteria, options),
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

  public async ttl(
    criteria: Predicate<E>,
    options: FindOptions<E> = {},
  ): Promise<number> {
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
      const document = await this.collection.findOne(
        this.createDefaultFilter(criteria, options),
        {
          projection: { [expiryDate.key]: 1 },
        },
      );

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

  public async updateMany(criteria: Predicate<E>, update: DeepPartial<E>): Promise<void> {
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
    criteria: Predicate<E>,
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

      if (
        result.matchedCount !== 1 &&
        result.modifiedCount !== 1 &&
        result.upsertedCount !== 1
      ) {
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

      await this.saveRelations(update, "update");

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

      await this.saveRelations(insert, "update");

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MongoRepositoryError("Unable to update entity", { error });
    }
  }

  // private relations

  private async destroyRelations(entity: E): Promise<void> {
    if (!this.metadata.relations.length) return;

    for (const relation of this.kit.metadata.relations) {
      if (relation.foreignConstructor() === this.parent) continue;
      if (relation.options.onDestroy !== "cascade") continue;

      if (relation.type === "ManyToMany") {
        const joinCollection = this.getJoinCollection(relation);
        const joinFilter: Record<string, any> = {};
        for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
          joinFilter[joinCol] = (entity as any)[entityCol];
        }
        await joinCollection.deleteMany(joinFilter);
        continue;
      }

      if (relation.joinKeys) continue;

      const { repository } = this.commonRelation(relation);

      switch (relation.type) {
        case "OneToMany": {
          const children = await repository.find(
            this.kit.relationFilter(relation, entity),
          );
          await repository.destroyBulk(children);
          break;
        }

        case "OneToOne": {
          const child = await repository.findOne(
            this.kit.relationFilter(relation, entity),
          );
          if (child) {
            await repository.destroy(child);
          }
          break;
        }

        default:
          break;
      }
    }
  }

  private async saveRelations(entity: E, mode: "insert" | "update"): Promise<void> {
    if (!this.metadata.relations.length) return;

    this.logger.debug("Inserting relations", { entity });

    for (const relation of this.kit.metadata.relations) {
      if (relation.foreignConstructor() === this.parent) continue;

      const shouldSave =
        (mode === "insert" && relation.options.onInsert === "cascade") ||
        (mode === "update" && relation.options.onUpdate === "cascade");

      const shouldOrphan =
        relation.options.onOrphan === "delete" &&
        mode === "update" &&
        (relation.type === "ManyToMany" || !relation.joinKeys);

      if (!shouldSave && !shouldOrphan) continue;

      if (relation.type === "ManyToMany") {
        const joinCollection = this.getJoinCollection(relation);
        const { mirror, repository } = this.commonRelation(relation);
        const targetKeys = this.getTargetFindKeys(relation, mirror);

        if (shouldSave) {
          await repository.saveBulk(entity[relation.key] ?? []);
        }

        if (shouldSave || shouldOrphan) {
          const joinFilter: Record<string, any> = {};
          for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
            joinFilter[joinCol] = (entity as any)[entityCol];
          }

          const existingJoins = await joinCollection.find(joinFilter).toArray();

          const desiredJoins = (entity[relation.key] ?? []).map((related: any) => {
            const joinDoc: Record<string, any> = {};
            for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
              const value = (entity as any)[entityCol];
              if (value == null) {
                throw new MongoRepositoryError(
                  "Cannot create join document with null key",
                  {
                    debug: { joinCol, entityCol, value },
                  },
                );
              }
              joinDoc[joinCol] = value;
            }
            for (const [joinCol, entityCol] of Object.entries(targetKeys)) {
              const value = related[entityCol];
              if (value == null) {
                throw new MongoRepositoryError(
                  "Cannot create join document with null key",
                  {
                    debug: { joinCol, entityCol, value },
                  },
                );
              }
              joinDoc[joinCol] = value;
            }
            return joinDoc;
          });

          const serializeJoin = (doc: Record<string, any>): string => {
            const { _id, ...rest } = doc;
            return JSON.stringify(rest);
          };

          const existingSet = new Set(existingJoins.map(serializeJoin));
          const desiredSet = new Set(desiredJoins.map((j: any) => JSON.stringify(j)));

          const toInsert = desiredJoins.filter(
            (j: any) => !existingSet.has(JSON.stringify(j)),
          );
          if (toInsert.length) {
            await joinCollection.insertMany(toInsert);
          }

          if (shouldOrphan) {
            const toRemove = existingJoins.filter(
              (j) => !desiredSet.has(serializeJoin(j)),
            );
            for (const orphan of toRemove) {
              await joinCollection.deleteOne({ _id: orphan._id });
            }
          }
        }

        continue;
      }

      const { repository } = this.commonRelation(relation);

      switch (relation.type) {
        case "OneToMany": {
          if (shouldSave) {
            await repository.saveBulk(entity[relation.key]);
          }
          if (shouldOrphan) {
            const existing = await repository.find(
              this.kit.relationFilter(relation, entity),
            );
            const currentIds = new Set(
              (entity[relation.key] ?? []).map((e: any) =>
                this.serializePrimaryKey(repository, e),
              ),
            );
            for (const orphan of existing) {
              if (!currentIds.has(this.serializePrimaryKey(repository, orphan))) {
                await repository.destroy(orphan);
              }
            }
          }
          break;
        }

        case "ManyToOne":
        case "OneToOne": {
          if (shouldSave && entity[relation.key]) {
            await repository.save(entity[relation.key]);
          }
          if (shouldOrphan) {
            const existing = await repository.findOne(
              this.kit.relationFilter(relation, entity),
            );
            if (existing && entity[relation.key]) {
              const oldKey = this.serializePrimaryKey(repository, existing);
              const newKey = this.serializePrimaryKey(repository, entity[relation.key]);
              if (oldKey !== newKey) {
                await repository.destroy(existing);
              }
            } else if (existing && !entity[relation.key]) {
              await repository.destroy(existing);
            }
          }
          break;
        }
      }
    }
  }

  private async loadRelations(document: any): Promise<E> {
    const entity = this.create(document);

    if (!this.metadata.relations.length) return entity;

    this.logger.debug("Loading relations", { entity });

    for (const relation of this.kit.metadata.relations) {
      if (relation.foreignConstructor() === this.parent) continue;

      switch (relation.options.loading) {
        case "eager":
          await this.loadEagerRelation(entity, relation);
          break;

        case "lazy":
          await this.loadLazyRelation(entity, relation);
          break;

        default:
          break;
      }

      if (
        relation.options.loading !== "ignore" &&
        (entity as any)[relation.key] === null &&
        relation.options.nullable === false
      ) {
        throw new MongoRepositoryError(`Relation [ ${relation.key} ] cannot be null`, {
          debug: { entity, relation },
        });
      }
    }

    return entity;
  }

  private async loadEagerRelation(entity: E, relation: MetaRelation): Promise<void> {
    const { mirror, repository } = this.commonRelation(relation);

    switch (relation.type) {
      case "OneToMany": {
        const found = await repository.find(this.kit.relationFilter(relation, entity));
        for (const item of found) {
          (item as any)[mirror.key] = entity;
        }
        (entity as any)[relation.key] = found;
        break;
      }

      case "OneToOne":
      case "ManyToOne": {
        const found = await repository.findOne(this.kit.relationFilter(relation, entity));
        if (found && !relation.joinKeys) {
          (found as any)[mirror.key] = entity;
        }
        (entity as any)[relation.key] = found;
        break;
      }

      case "ManyToMany": {
        const found = await this.loadManyToMany(entity, relation, mirror, repository);
        (entity as any)[relation.key] = found;
        break;
      }

      default:
        break;
    }
  }

  private async loadLazyRelation(entity: E, relation: MetaRelation): Promise<void> {
    const { mirror, repository } = this.commonRelation(relation);

    switch (relation.type) {
      case "OneToMany": {
        (entity as any)[relation.key] = this.lazyProxy(
          async (): Promise<Array<IEntity>> => {
            const found = await repository.find(
              this.kit.relationFilter(relation, entity),
            );
            for (const item of found) {
              (item as any)[mirror.key] = entity;
            }
            return found;
          },
        );
        break;
      }

      case "OneToOne":
      case "ManyToOne": {
        (entity as any)[relation.key] = this.lazyProxy(
          async (): Promise<IEntity | null> => {
            const found = await repository.findOne(
              this.kit.relationFilter(relation, entity),
            );
            if (found && !relation.joinKeys) {
              (found as any)[mirror.key] = entity;
            }
            return found;
          },
        );
        break;
      }

      case "ManyToMany": {
        (entity as any)[relation.key] = this.lazyProxy(
          async (): Promise<Array<IEntity>> => {
            return this.loadManyToMany(entity, relation, mirror, repository);
          },
        );
        break;
      }

      default:
        break;
    }
  }

  private async loadManyToMany(
    entity: E,
    relation: MetaRelation,
    mirror: MetaRelation,
    repository: MongoRepository<IEntity>,
  ): Promise<Array<IEntity>> {
    const joinCollection = this.getJoinCollection(relation);
    const targetKeys = this.getTargetFindKeys(relation, mirror);

    const joinFilter: Record<string, any> = {};
    for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
      joinFilter[joinCol] = (entity as any)[entityCol];
    }

    const joinDocs = await joinCollection.find(joinFilter).toArray();
    if (!joinDocs.length) return [];

    const foreignIds: Array<Record<string, any>> = joinDocs.map((doc) => {
      const ids: Record<string, any> = {};
      for (const [joinCol, entityCol] of Object.entries(targetKeys)) {
        ids[entityCol] = doc[joinCol];
      }
      return ids;
    });

    const found = await repository.find({ $or: foreignIds } as any);

    const isSelfReferencing =
      relation.key === mirror.key && relation.foreignKey === mirror.foreignKey;

    if (!isSelfReferencing) {
      for (const item of found) {
        (item as any)[mirror.key] = entity;
      }
    }

    return found;
  }

  private async setupJoinCollectionIndexes(): Promise<void> {
    for (const relation of this.kit.metadata.relations) {
      if (relation.type !== "ManyToMany") continue;
      if (!relation.joinTable) continue;

      const { mirror } = this.commonRelation(relation);
      const joinCollection = this.getJoinCollection(relation);
      const targetKeys = this.getTargetFindKeys(relation, mirror);

      const indexSpec: Record<string, 1> = {};

      for (const joinCol of Object.keys(relation.findKeys!)) {
        indexSpec[joinCol] = 1;
      }
      for (const joinCol of Object.keys(targetKeys)) {
        indexSpec[joinCol] = 1;
      }

      try {
        await joinCollection.createIndex(indexSpec, { unique: true });

        this.logger.debug("Join collection index created", {
          collection: joinCollection.collectionName,
          index: indexSpec,
        });
      } catch (error: any) {
        this.logger.error("Join collection index error", error);

        throw new MongoRepositoryError(error.message, {
          debug: {
            collection: joinCollection.collectionName,
            index: indexSpec,
          },
          error,
        });
      }
    }
  }

  // Self-referencing ManyToMany: mirror is the same relation, so mirror.findKeys
  // equals relation.findKeys. Derive target keys from joinKeys minus findKeys.
  private getTargetFindKeys(
    relation: MetaRelation,
    mirror: MetaRelation,
  ): Record<string, string> {
    if (relation.key === mirror.key && relation.foreignKey === mirror.foreignKey) {
      const findKeySet = new Set(Object.keys(relation.findKeys!));
      return Object.fromEntries(
        Object.entries(relation.joinKeys!).filter(([k]) => !findKeySet.has(k)),
      );
    }
    return mirror.findKeys as Record<string, string>;
  }

  private getJoinCollection(relation: MetaRelation): Collection {
    const name = getJoinCollectionName(relation.joinTable as string, {
      namespace: this.metadata.entity.namespace,
    });
    return this.database.collection(name);
  }

  private commonRelation(relation: MetaRelation): {
    mirror: MetaRelation;
    repository: MongoRepository<IEntity>;
  } {
    const repository = new MongoRepository({
      target: relation.foreignConstructor(),
      parent: this.kit.target,
      database: this.databaseName,
      client: this.client,
      logger: this.logger,
    });

    const mirror = repository.kit.metadata.relations.find(
      (r) => r.key === relation.foreignKey,
    );

    if (!mirror) {
      throw new MongoRepositoryError("Mirror relation not found", {
        debug: { relation },
      });
    }

    return {
      mirror,
      repository,
    };
  }

  private lazyProxy<T>(callback: () => Promise<T>): Promise<T> {
    let cached: Promise<T> | undefined;

    return new Proxy(
      {},
      {
        get: (_, prop): any => {
          if (prop === "then") {
            if (!cached) {
              cached = callback();
            }
            return cached.then.bind(cached);
          }
          return undefined;
        },
      },
    ) as unknown as Promise<T>;
  }

  // private

  private combineFilter(criteria: Predicate<E>, options: FindOptions<E> = {}): Filter<E> {
    return {
      ...predicateToMongo(criteria),
      ...(options.mongoFilter ?? {}),
    };
  }

  private createPrimaryFilter(entity: E): Filter<E> {
    const result: Predicate<any> = {};

    for (const key of this.metadata.primaryKeys) {
      result[key] = entity[key];
    }

    return result;
  }

  private createDefaultFilter(
    criteria: Predicate<E> = {},
    options: FindOptions<E> = {},
  ): Filter<E> {
    const result: Filter<any> = this.combineFilter(criteria, options);

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
    const result: Predicate<any> = this.createPrimaryFilter(entity);

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

  private createFindVersionsFilter(criteria: Predicate<E>): Filter<E> {
    const result: Filter<any> = this.combineFilter(criteria);

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

  private serializePrimaryKey(
    repository: MongoRepository<IEntity>,
    entity: IEntity,
  ): string {
    return repository.metadata.primaryKeys.map((k) => String(entity[k])).join("|");
  }
}
