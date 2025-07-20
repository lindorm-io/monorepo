import { EntityKit, IEntity, MetaSource } from "@lindorm/entity";
import { isDate } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { DeepPartial, Predicate } from "@lindorm/types";
import { MnemosRepositoryError } from "../errors";
import { IMnemosCache, IMnemosCollection, IMnemosRepository } from "../interfaces";
import { MnemosRepositoryOptions } from "../types";

const PRIMARY_SOURCE: MetaSource = "MnemosSource" as const;

export class MnemosRepository<
  E extends IEntity = IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IMnemosRepository<E, O>
{
  private readonly cache: IMnemosCache;
  private readonly collection: IMnemosCollection<E>;
  private readonly collectionName: string;
  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly logger: ILogger;

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
    this.collection = this.cache.collection(this.collectionName, this.kit.metadata);

    if (this.kit.metadata.relations.length > 0) {
      this.logger.warn(
        "This version of @lindorm/mnemos does not support relations. Make sure to handle this manually or keep your eye open for updates.",
      );
    }
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
    this.collection.delete(predicate);

    this.logger.debug("Repository done: delete", { input: { predicate } });
  }

  public async destroy(entity: E): Promise<void> {
    this.collection.delete(this.createPrimaryPredicate(entity));

    this.logger.debug("Repository done: destroy", { input: { entity } });

    this.kit.onDestroy(entity);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    for (const entity of entities) {
      this.destroy(entity);
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

    this.logger.debug("Repository done: find", {
      input: { predicate },
      result: { count: entities.length, entities },
    });

    return entities;
  }

  public async findOne(predicate: Predicate<E>): Promise<E | null> {
    const [entity] = this.filterCollection(predicate);

    this.logger.debug("Repository done: findOne", {
      input: { predicate },
      result: { entity },
    });

    return entity ?? null;
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
    entity =
      entity instanceof this.kit.metadata.entity.target ? entity : this.create(entity);

    const insert = await this.kit.insert(entity);

    try {
      this.validate(insert);

      this.collection.insertOne(insert);

      this.logger.debug("Repository done: insert", { input: { insert } });

      this.kit.onInsert(insert);

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new MnemosRepositoryError("Unable to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<O | E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.insert(entity)));
  }

  public async save(entity: O | E): Promise<E> {
    entity =
      entity instanceof this.kit.metadata.entity.target ? entity : this.create(entity);

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

  // private

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
