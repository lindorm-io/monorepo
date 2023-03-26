import { MongoRepositoryError } from "../errors";
import { Logger } from "@lindorm-io/core-logger";
import { snakeCase } from "@lindorm-io/case";
import {
  Collection,
  CountDocumentsOptions,
  DeleteOptions,
  Filter,
  FindOptions,
  IndexSpecification,
} from "mongodb";
import {
  IMongoConnection,
  MongoDocument,
  MongoEntity,
  MongoIndexOptions,
  MongoRepository,
  MongoRepositoryOptions,
  PostChangeCallback,
} from "../types";
import {
  EntityNotCreatedError,
  EntityNotFoundError,
  EntityNotRemovedError,
  EntityNotUpdatedError,
} from "@lindorm-io/entity";

export abstract class MongoRepositoryBase<
  Document extends MongoDocument,
  Entity extends MongoEntity,
> implements MongoRepository<Document, Entity>
{
  private readonly collectionName: string;
  private readonly connection: IMongoConnection;
  private readonly indices: Array<MongoIndexOptions<Document>>;
  private readonly logger: Logger;

  private collection: Collection | undefined;
  private promise: () => Promise<void>;

  protected constructor(
    connection: IMongoConnection,
    logger: Logger,
    options: MongoRepositoryOptions<Document>,
  ) {
    this.logger = logger.createChildLogger(["MongoRepositoryBase", this.constructor.name]);

    this.connection = connection;
    this.collectionName = snakeCase(options.entityName);
    this.indices = [
      {
        index: { id: 1 },
        options: { unique: true },
      },
      ...options.indices,
    ];

    this.promise = this.initialise;
  }

  // private

  private async initialise(): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    this.collection = this.connection.collection(this.collectionName);

    for (const { index, options } of this.indices) {
      for (const [key, value] of Object.entries(index)) {
        if (value !== 1 && value !== 0) {
          throw new Error(`Index [ ${key} ] has invalid value [ ${value} ]`);
        }
      }

      await this.collection.createIndex(index as IndexSpecification, options);
    }

    this.logger.debug("Initialisation successful", {
      collection: this.collectionName,
      indices: this.indices,
      time: Date.now() - start,
    });

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // protected

  protected abstract createDocument(entity: Entity): Document;

  protected abstract createEntity(document: Document): Entity;

  protected abstract validateSchema(entity: Entity): Promise<void>;

  // public

  public async count(
    filter: Partial<Filter<Document>> = {},
    options: CountDocumentsOptions = {},
  ): Promise<number> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    const amount = await this.collection.countDocuments(filter as Filter<any>, options);

    this.logger.debug("countDocuments", {
      input: {
        filter,
        options,
      },
      result: {
        amount,
        success: true,
        time: Date.now() - start,
      },
    });

    return amount;
  }

  public async create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

    const start = Date.now();

    entity.updated = new Date();

    const document = this.createDocument(entity);

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.insertOne(document);

      this.logger.debug("insertOne", {
        input: {
          document,
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });

      if (callback) {
        await callback(entity);
      }

      return entity;
    } catch (err: any) {
      this.logger.silly("Mongo error", err);
      throw new EntityNotCreatedError("Unable to create entity", {
        error: err,
      });
    }
  }

  public async createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.create(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async deleteMany(
    filter: Partial<Filter<Document>>,
    options: DeleteOptions = {},
  ): Promise<void> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    const result = await this.collection.deleteMany(filter as Filter<any>, options);

    this.logger.debug("deleteMany", {
      input: {
        filter,
      },
      result: {
        ...result,
        time: Date.now() - start,
      },
    });
  }

  public async destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void> {
    const start = Date.now();

    const { id } = this.createDocument(entity);

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.deleteOne({ id });

      this.logger.debug("findOneAndDelete", {
        input: {
          filter: { id },
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });

      if (callback) {
        await callback(entity);
      }
    } catch (err: any) {
      this.logger.silly("Mongo error", err);
      throw new EntityNotRemovedError("Unable to remove entity", {
        error: err,
      });
    }
  }

  public async destroyMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>> {
    const promises: Array<Promise<void>> = [];

    for (const entity of entities) {
      promises.push(this.destroy(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async find(
    filter: Partial<Filter<Document>>,
    options: FindOptions<Document> = {},
  ): Promise<Entity> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.findOne(filter as Filter<any>, options);

      this.logger.debug("findOne", {
        input: {
          filter,
          options,
        },
        result: {
          success: !!result,
          time: Date.now() - start,
        },
      });

      if (!result) {
        throw new MongoRepositoryError("Unable to find entity", {
          debug: { filter, options, result },
        });
      }

      return this.createEntity(result as unknown as Document);
    } catch (err: any) {
      this.logger.silly("Mongo error", err);

      throw new EntityNotFoundError("Unable to find entity", {
        error: err,
        debug: { filter, options },
      });
    }
  }

  public async findMany(
    filter: Partial<Filter<Document>> = {},
    options: FindOptions<Document> = {},
  ): Promise<Array<Entity>> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    const cursor = await this.collection.find(filter as Filter<any>, options);
    const results = await cursor.toArray();

    this.logger.debug("find", {
      input: {
        filter,
        options,
      },
      result: {
        amount: results.length,
        success: !!results.length,
        time: Date.now() - start,
      },
    });

    const entities: Array<Entity> = [];

    for (const item of results) {
      entities.push(this.createEntity(item as unknown as Document));
    }

    return entities;
  }

  public async findOrCreate(
    filter: Partial<Filter<Document>>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity> {
    try {
      return await this.find(filter);
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        return await this.create(this.createEntity(filter as Document), callback);
      }
      throw err;
    }
  }

  public async tryFind(
    filter: Partial<Filter<Document>>,
    options: FindOptions<Document> = {},
  ): Promise<Entity | undefined> {
    try {
      return await this.find(filter, options);
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        return undefined;
      }
      throw err;
    }
  }

  public async update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

    const start = Date.now();
    const currentRevision = entity.revision;

    entity.revision += 1;
    entity.updated = new Date();

    const { id, ...payload } = this.createDocument(entity);
    const filter = {
      id,
      revision: { $eq: currentRevision },
    };

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.updateOne(filter, { $set: payload });

      this.logger.debug("updateOne", {
        input: {
          filter,
          payload,
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });

      if (result.modifiedCount !== 1) {
        throw new MongoRepositoryError("Entity not updated", {
          debug: { filter, result },
        });
      }

      if (callback) {
        await callback(entity);
      }

      return entity;
    } catch (err: any) {
      this.logger.silly("Mongo error", err);
      throw new EntityNotUpdatedError("Unable to update entity", {
        error: err,
      });
    }
  }

  public async updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>> {
    const promises: Array<Promise<Entity>> = [];

    for (const entity of entities) {
      promises.push(this.update(entity, callback));
    }

    return Promise.allSettled(promises);
  }

  public async upsert(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity> {
    await this.validateSchema(entity);

    const start = Date.now();
    const currentRevision = entity.revision;

    entity.revision += 1;
    entity.updated = new Date();

    const { id, ...payload } = this.createDocument(entity);
    const filter = {
      id,
      revision: { $eq: currentRevision },
    };

    await this.promise();

    if (!this.collection) {
      throw new MongoRepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.updateOne(filter, { $set: payload }, { upsert: true });

      this.logger.debug("updateOne", {
        input: {
          filter,
          payload,
          upsert: true,
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });

      if (callback) {
        await callback(entity);
      }

      return entity;
    } catch (err: any) {
      this.logger.silly("Mongo error", err);
      throw new EntityNotUpdatedError("Unable to upsert entity", {
        error: err,
      });
    }
  }
}
