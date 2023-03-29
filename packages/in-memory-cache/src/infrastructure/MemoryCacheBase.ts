import { EntityNotFoundError } from "@lindorm-io/entity";
import { Logger } from "@lindorm-io/core-logger";
import { MemoryCacheError } from "../errors";
import { isAfter } from "date-fns";
import {
  IMemoryDatabase,
  MemoryCache,
  MemoryCacheOptions,
  MemoryCollection,
  MemoryDocument,
  MemoryEntity,
} from "../types";

export abstract class MemoryCacheBase<Document extends MemoryDocument, Entity extends MemoryEntity>
  implements MemoryCache<Document, Entity>
{
  private readonly collection: MemoryCollection<Document>;
  private readonly logger: Logger;
  private readonly ttlAttribute: keyof Document | undefined;

  protected constructor(
    database: IMemoryDatabase,
    logger: Logger,
    options: MemoryCacheOptions<Document>,
  ) {
    this.logger = logger.createChildLogger(["LindormMemoryCache", options.entityName]);

    this.collection = database.collection(options.entityName);
    this.ttlAttribute = options.ttlAttribute;
  }

  // protected

  protected abstract createDocument(entity: Entity): Document;

  protected abstract createEntity(document: Document): Entity;

  protected abstract validateSchema(entity: Entity): Promise<void>;

  // public

  public async count(attributes: Partial<Document>): Promise<number> {
    this.logger.debug("count", { attributes });

    this.runCleanup();

    const results = this.collection.filter(attributes);

    return results.length;
  }

  public async create(entity: Entity): Promise<Entity> {
    this.logger.debug("create", { entity });

    await this.validateSchema(entity);

    const found = await this.tryFind({ id: entity.id } as Document);

    if (found) {
      throw new MemoryCacheError("Entity already exists in cache", {
        debug: { found },
      });
    }

    entity.updated = new Date();

    const document = this.createDocument(entity);
    this.collection.insert(document);

    return entity;
  }

  public async createMany(entities: Array<Entity>): Promise<Array<Entity>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.create(entity));
    }

    return await Promise.all(promises);
  }

  public async deleteMany(attributes: Partial<Document>): Promise<void> {
    const entities = await this.findMany(attributes);

    await this.destroyMany(entities);
  }

  public async destroy(entity: Entity): Promise<void> {
    this.logger.debug("destroy", { entity });

    await this.find({ id: entity.id } as Document);

    this.collection.delete({ id: entity.id } as Document);
  }

  public async destroyMany(entities: Array<Entity>): Promise<void> {
    const promises = [];

    for (const entity of entities) {
      promises.push(this.destroy(entity));
    }

    await Promise.all(promises);
  }

  public async find(attributes: Partial<Document>): Promise<Entity> {
    const entity = await this.tryFind(attributes);

    if (!entity) {
      throw new EntityNotFoundError("Unable to find entity", {
        debug: { attributes },
      });
    }

    return entity;
  }

  public async findMany(attributes: Partial<Document>): Promise<Array<Entity>> {
    this.logger.debug("findMany", { attributes });

    this.runCleanup();

    const results = this.collection.filter(attributes);
    const entities: Array<Entity> = [];

    for (const result of results) {
      entities.push(this.createEntity(result));
    }

    return entities;
  }

  public async findOrCreate(attributes: Partial<Document>): Promise<Entity> {
    const result = await this.tryFind(attributes);

    if (result) {
      return result;
    }

    return await this.create(this.createEntity(attributes as Document));
  }

  public async tryFind(attributes: Partial<Document>): Promise<Entity | undefined> {
    this.logger.debug("tryFind", { attributes });

    this.runCleanup();

    const result = this.collection.find(attributes);

    if (result) {
      return this.createEntity(result);
    }
  }

  public async ttl(entity: Entity): Promise<number> {
    if (!this.ttlAttribute) {
      throw new MemoryCacheError("TTL attribute not set");
    }

    const found = await this.find({ id: entity.id } as Document);
    const document = this.createDocument(found);
    const ttl = document[this.ttlAttribute];

    if (!(ttl instanceof Date)) {
      throw new MemoryCacheError("TTL attribute is not a Date", {
        debug: { ttl },
      });
    }

    return Math.round((ttl.getTime() - Date.now()) / 1000);
  }

  public async update(entity: Entity): Promise<Entity> {
    this.logger.debug("update", { entity });

    await this.validateSchema(entity);

    await this.find({ id: entity.id } as Document);
    await this.destroy(entity);

    return await this.create(entity);
  }

  public async updateMany(entities: Array<Entity>): Promise<Array<Entity>> {
    const promises = [];

    for (const entity of entities) {
      promises.push(this.update(entity));
    }

    return await Promise.all(promises);
  }

  public async upsert(entity: Entity): Promise<Entity> {
    this.logger.debug("upsert", { entity });

    await this.validateSchema(entity);

    const found = await this.tryFind({ id: entity.id } as Document);

    if (found) {
      await this.destroy(found);
    }

    entity.updated = new Date();

    const document = this.createDocument(entity);
    this.collection.insert(document);

    return entity;
  }

  // private

  private runCleanup(): void {
    if (!this.ttlAttribute) {
      return;
    }

    this.logger.silly("Removing expired entities from collection");

    for (const item of this.collection.filter()) {
      const ttl = item[this.ttlAttribute];

      if (!(ttl instanceof Date)) continue;
      if (isAfter(ttl, new Date())) continue;

      this.collection.delete({ id: item.id } as Document);
    }
  }
}
