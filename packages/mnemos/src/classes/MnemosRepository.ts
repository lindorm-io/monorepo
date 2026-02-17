import {
  EntityKit,
  getJoinCollectionName,
  globalEntityMetadata,
  IEntity,
  MetaRelation,
  MetaSource,
} from "@lindorm/entity";
import { isDate } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import { MnemosRepositoryError } from "../errors";
import { IMnemosCache, IMnemosCollection, IMnemosRepository } from "../interfaces";
import { MnemosRepositoryOptions } from "../types";

const PRIMARY_SOURCE: MetaSource = "MnemosSource" as const;

export class MnemosRepository<
  E extends IEntity = IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IMnemosRepository<E, O> {
  private readonly cache: IMnemosCache;
  private readonly collection: IMnemosCollection<E>;
  private readonly collectionName: string;
  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;
  private readonly parent: Constructor<E> | undefined;

  public constructor(options: MnemosRepositoryOptions<E>) {
    this.logger = options.logger.child(["MnemosRepository", options.target.name]);

    this.kit = new EntityKit({
      target: options.target,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.cache = options.cache;
    this.collectionName = this.kit.getCollectionName(options);
    this.incrementName = this.kit.getIncrementName(options);
    this.namespace = options.namespace;
    this.parent = options.parent;
    this.collection = this.cache.collection(this.collectionName, this.kit.metadata);
  }

  // public

  public create(options: O | E): E {
    return this.kit.create(options);
  }

  public copy(entity: E): E {
    return this.kit.copy(entity);
  }

  public validate(entity: E): void {
    return this.kit.validate(entity);
  }

  public async count(predicate: Predicate<E>): Promise<number> {
    const entities = this.filterCollection(predicate);
    const count = entities.length;

    this.logger.debug("Repository done: count", {
      input: { predicate },
      result: { count },
    });

    return count;
  }

  public async delete(predicate: Predicate<E>): Promise<void> {
    const entities = await this.find(predicate);

    for (const entity of entities) {
      await this.destroy(entity);
    }
  }

  public async destroy(entity: E): Promise<void> {
    await this.destroyRelations(entity);

    this.collection.delete(this.createPrimaryPredicate(entity));

    this.logger.debug("Repository done: destroy", { input: { entity } });

    this.kit.onDestroy(entity);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    for (const entity of entities) {
      await this.destroy(entity);
    }
  }

  public async exists(predicate: Predicate<E>): Promise<boolean> {
    const entities = this.filterCollection(predicate);
    const exists = entities.length > 0;

    this.logger.debug("Repository done: exists", {
      input: { predicate },
      result: { exists },
    });

    return exists;
  }

  public async find(predicate: Predicate<E> = {}): Promise<Array<E>> {
    const entities = this.filterCollection(predicate);

    const result: Array<E> = [];
    for (const entity of entities) {
      result.push(await this.loadRelations(entity));
    }

    this.logger.debug("Repository done: find", {
      input: { predicate },
      result: { count: result.length, entities: result },
    });

    return result;
  }

  public async findOne(predicate: Predicate<E>): Promise<E | null> {
    const [entity] = this.filterCollection(predicate);

    if (!entity) {
      this.logger.debug("Repository done: findOne", {
        input: { predicate },
        result: { entity: undefined },
      });
      return null;
    }

    const loaded = await this.loadRelations(entity);

    this.logger.debug("Repository done: findOne", {
      input: { predicate },
      result: { entity: loaded },
    });

    return loaded;
  }

  public async findOneOrFail(predicate: Predicate<E>): Promise<E> {
    const entity = await this.findOne(predicate);

    if (!entity) {
      throw new MnemosRepositoryError("Entity not found", { debug: { predicate } });
    }

    return entity;
  }

  public async findOneOrSave(predicate: Predicate<E>, options?: O): Promise<E> {
    const entity = await this.findOne(predicate);
    if (entity) return entity;

    return this.save(this.create({ ...predicate, ...options } as O));
  }

  public async insert(entity: O | E): Promise<E> {
    entity = entity instanceof this.kit.metadata.target ? entity : this.create(entity);

    const insert = await this.kit.insert(entity);

    try {
      this.validate(insert);

      const predicate = this.createPrimaryPredicate(insert);
      const existing = this.collection.find(predicate);
      if (existing) {
        throw new MnemosRepositoryError("Entity already exists", {
          code: "duplicate_record",
          debug: { predicate },
        });
      }

      this.collection.insertOne(insert);

      this.logger.debug("Repository done: insert", { input: { insert } });

      this.kit.onInsert(insert);

      await this.saveRelations(insert, "insert");

      return insert;
    } catch (error: any) {
      if (error.code === "duplicate_record") throw error;
      this.logger.error("Repository error", error);
      throw new MnemosRepositoryError("Unable to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<O | E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.insert(entity)));
  }

  public async save(entity: O | E): Promise<E> {
    entity = entity instanceof this.kit.metadata.target ? entity : this.create(entity);

    const strategy = this.kit.getSaveStrategy(entity);

    switch (strategy) {
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
      if (err.code === "duplicate_record") {
        return await this.update(entity);
      }
      throw err;
    }
  }

  public async saveBulk(entities: Array<O | E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async update(entity: E): Promise<E> {
    this.validate(entity);

    const predicate = this.createDefaultPredicate(this.createPrimaryPredicate(entity));

    if (!this.exists(predicate)) {
      throw new MnemosRepositoryError("Entity not found", { debug: { predicate } });
    }

    const filter = this.createUpdatePredicate(entity);
    const update = this.kit.update(entity);

    this.collection.update(filter, update);

    this.logger.debug("Repository done: update", { input: { filter, update } });

    this.kit.onUpdate(update);

    await this.saveRelations(update, "update");

    return update;
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.update(entity)));
  }

  public async ttl(predicate: Predicate<E>): Promise<number> {
    const [entity] = this.filterCollection(predicate);

    this.logger.debug("Repository done: ttl", {
      input: { predicate },
      result: { entity },
    });

    if (!entity) {
      throw new MnemosRepositoryError("Entity not found", { debug: { predicate } });
    }

    const expiryDate = this.kit.metadata.columns.find(
      (a) => a.decorator === "ExpiryDateColumn",
    );
    if (!expiryDate) {
      throw new MnemosRepositoryError("Entity does not have expiry date", {
        debug: { entity },
      });
    }

    const attribute = (entity as any)[expiryDate.key];

    if (!isDate(attribute)) {
      throw new MnemosRepositoryError("Entity does not have expiry date", {
        debug: { entity },
      });
    }

    return Math.floor((attribute.getTime() - Date.now()) / 1000);
  }

  // private - predicates

  private createPrimaryPredicate(entity: E): Predicate<E> {
    const result: Predicate<any> = {};

    for (const key of this.kit.metadata.primaryKeys) {
      result[key] = entity[key];
    }

    return result;
  }

  private createDefaultPredicate(predicate: Predicate<E> = {}): Predicate<E> {
    const result: Predicate<any> = { ...predicate };

    const expiryDate = this.kit.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (expiryDate) {
      result["$or"] = [
        { [expiryDate.key]: null },
        { [expiryDate.key]: { $gt: new Date() } },
      ];
    }

    return result;
  }

  private createUpdatePredicate(entity: E): Predicate<E> {
    const result: Predicate<any> = this.createPrimaryPredicate(entity);

    if (!this.kit.isPrimarySource) {
      this.logger.debug("Skipping update predicate for non-primary source", {
        source: this.kit.metadata.primarySource,
      });
      return result;
    }

    const deleteDate = this.kit.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (deleteDate) {
      result[deleteDate.key] = { $eq: null };
    }

    const expiryDate = this.kit.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (expiryDate) {
      result["$or"] = [
        { [expiryDate.key]: null },
        { [expiryDate.key]: { $gt: new Date() } },
      ];
    }

    const version = this.kit.metadata.columns.find(
      (c) => c.decorator === "VersionColumn",
    );
    if (version) {
      result[version.key] = { $eq: entity[version.key] };
    }

    return result;
  }

  private filterCollection(predicate: Predicate<E>): Array<E> {
    return this.collection.filter(this.createDefaultPredicate(predicate));
  }

  // private - relations

  private async destroyRelations(entity: E): Promise<void> {
    if (!this.kit.metadata.relations.length) return;

    for (const relation of this.kit.metadata.relations) {
      if (relation.foreignConstructor() === this.parent) continue;
      if (relation.options.onDestroy !== "cascade") continue;

      if (relation.type === "ManyToMany") {
        const joinCollection = this.getJoinCollection(relation);
        const joinFilter: Record<string, any> = {};
        for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
          joinFilter[joinCol] = (entity as any)[entityCol];
        }
        joinCollection.delete(joinFilter);
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
    if (!this.kit.metadata.relations.length) return;

    this.logger.debug("Saving relations", { entity });

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

          const existingJoins = joinCollection.filter(joinFilter);

          const desiredJoins = (entity[relation.key] ?? []).map((related: any) => {
            const joinDoc: Record<string, any> = {};
            for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
              const value = (entity as any)[entityCol];
              if (value == null) {
                throw new MnemosRepositoryError(
                  "Cannot create join document with null key",
                  { debug: { joinCol, entityCol, value } },
                );
              }
              joinDoc[joinCol] = value;
            }
            for (const [joinCol, entityCol] of Object.entries(targetKeys)) {
              const value = related[entityCol];
              if (value == null) {
                throw new MnemosRepositoryError(
                  "Cannot create join document with null key",
                  { debug: { joinCol, entityCol, value } },
                );
              }
              joinDoc[joinCol] = value;
            }
            return joinDoc;
          });

          const serializeJoin = (doc: Record<string, any>): string => JSON.stringify(doc);

          const existingSet = new Set(existingJoins.map(serializeJoin));
          const desiredSet = new Set(desiredJoins.map((j: any) => JSON.stringify(j)));

          const toInsert = desiredJoins.filter(
            (j: any) => !existingSet.has(JSON.stringify(j)),
          );
          if (toInsert.length) {
            joinCollection.insertMany(toInsert);
          }

          if (shouldOrphan) {
            const toRemove = existingJoins.filter(
              (j) => !desiredSet.has(serializeJoin(j)),
            );
            for (const orphan of toRemove) {
              joinCollection.delete(orphan);
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

  private async loadRelations(entity: E): Promise<E> {
    if (!this.kit.metadata.relations.length) return entity;

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
        throw new MnemosRepositoryError(`Relation [ ${relation.key} ] cannot be null`, {
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
    repository: MnemosRepository<IEntity>,
  ): Promise<Array<IEntity>> {
    const joinCollection = this.getJoinCollection(relation);
    const targetKeys = this.getTargetFindKeys(relation, mirror);

    const joinFilter: Record<string, any> = {};
    for (const [joinCol, entityCol] of Object.entries(relation.findKeys!)) {
      joinFilter[joinCol] = (entity as any)[entityCol];
    }

    const joinDocs = joinCollection.filter(joinFilter);
    if (!joinDocs.length) return [];

    const isSelfReferencing =
      relation.key === mirror.key && relation.foreignKey === mirror.foreignKey;

    const entities: Array<IEntity> = [];

    for (const doc of joinDocs) {
      const predicate: Record<string, any> = {};
      for (const [joinCol, entityCol] of Object.entries(targetKeys)) {
        predicate[entityCol] = doc[joinCol];
      }
      const found = await repository.findOne(predicate);
      if (found) {
        if (!isSelfReferencing) {
          (found as any)[mirror.key] = entity;
        }
        entities.push(found);
      }
    }

    return entities;
  }

  // private - relation helpers

  private commonRelation(relation: MetaRelation): {
    mirror: MetaRelation;
    repository: MnemosRepository<IEntity>;
  } {
    const repository = new MnemosRepository({
      target: relation.foreignConstructor(),
      parent: this.kit.target,
      cache: this.cache,
      logger: this.logger,
      namespace: this.namespace,
    });

    const foreignMetadata = globalEntityMetadata.get(relation.foreignConstructor());
    const mirror = foreignMetadata.relations.find((r) => r.key === relation.foreignKey);

    if (!mirror) {
      throw new MnemosRepositoryError("Mirror relation not found", {
        debug: { relation },
      });
    }

    return { mirror, repository };
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

  private getJoinCollection(relation: MetaRelation): IMnemosCollection<Dict> {
    const name = getJoinCollectionName(relation.joinTable as string, {
      namespace: this.namespace,
    });
    return this.cache.collection(name);
  }

  private serializePrimaryKey(
    repository: MnemosRepository<IEntity>,
    entity: IEntity,
  ): string {
    return repository.kit.metadata.primaryKeys.map((k) => String(entity[k])).join("|");
  }

  // private - increments

  private async getNextIncrement(key: string): Promise<number> {
    const start = Date.now();

    try {
      const collection = this.cache.collection<{ key: string; value: number }>(
        this.incrementName,
      );

      let document = collection.find({ key });

      if (!document) {
        document = collection.insertOne({ key, value: 0 });
      }

      document.value = document.value + 1;

      collection.update({ key }, { value: document.value });

      this.logger.silly("Repository done: getNextIncrement", {
        input: { key },
        result: {
          collection: this.collectionName,
          increment: this.incrementName,
          document,
        },
        time: Date.now() - start,
      });

      return document.value;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MnemosRepositoryError("Unable to get next increment", { error });
    }
  }
}
