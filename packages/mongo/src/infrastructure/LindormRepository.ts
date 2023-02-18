import { CountDocumentsOptions, DeleteOptions, Filter, FindOptions } from "mongodb";
import { IRepository, PostChangeCallback } from "../types";
import { RepositoryBase } from "./RepositoryBase";
import { RepositoryError } from "../error";
import {
  EntityAttributes,
  EntityNotCreatedError,
  EntityNotFoundError,
  EntityNotRemovedError,
  EntityNotUpdatedError,
  ILindormEntity,
} from "@lindorm-io/entity";

export abstract class LindormRepository<
    Interface extends EntityAttributes,
    Entity extends ILindormEntity<Interface>,
  >
  extends RepositoryBase<Interface>
  implements IRepository<Interface, Entity>
{
  // protected

  protected abstract createEntity(data: Interface): Entity;

  // public

  public async count(
    filter: Partial<Filter<Interface>> = {},
    options: CountDocumentsOptions = {},
  ): Promise<number> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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
    await entity.schemaValidation();

    const start = Date.now();

    entity.updated = new Date();

    const json = entity.toJSON();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
    }

    try {
      const result = await this.collection.insertOne(json);

      this.logger.debug("insertOne", {
        input: {
          payload: json,
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
    filter: Partial<Filter<Interface>>,
    options: DeleteOptions = {},
  ): Promise<void> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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

    const { id } = entity.toJSON();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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
    filter: Partial<Filter<Interface>>,
    options: FindOptions<Interface> = {},
  ): Promise<Entity> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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
        throw new RepositoryError("Unable to find entity", {
          debug: { filter, options, result },
        });
      }

      return this.createEntity(result as unknown as Interface);
    } catch (err: any) {
      this.logger.silly("Mongo error", err);
      throw new EntityNotFoundError("Unable to find entity", {
        error: err,
      });
    }
  }

  public async findMany(
    filter: Partial<Filter<Interface>> = {},
    options: FindOptions<Interface> = {},
  ): Promise<Array<Entity>> {
    const start = Date.now();

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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
      entities.push(this.createEntity(item as unknown as Interface));
    }

    return entities;
  }

  public async findOrCreate(
    filter: Partial<Interface>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity> {
    try {
      return await this.find(filter);
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        return await this.create(this.createEntity(filter as Interface), callback);
      }
      throw err;
    }
  }

  public async tryFind(
    filter: Partial<Filter<Interface>>,
    options: FindOptions<Interface> = {},
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
    await entity.schemaValidation();

    const start = Date.now();
    const currentRevision = entity.revision;

    entity.revision += 1;
    entity.updated = new Date();

    const { id, ...payload } = entity.toJSON();
    const filter = {
      id,
      revision: { $eq: currentRevision },
    };

    await this.promise();

    if (!this.collection) {
      throw new RepositoryError("Collection not found");
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
        throw new RepositoryError("Entity not updated", {
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
}
