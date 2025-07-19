import { snakeCase } from "@lindorm/case";
import { expiresIn } from "@lindorm/date";
import { EntityKit, IEntity, MetaSource } from "@lindorm/entity";
import { isDate, isObjectLike } from "@lindorm/is";
import { Primitive } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { DeepPartial, Dict } from "@lindorm/types";
import { Predicate, Predicated } from "@lindorm/utils";
import { Redis } from "ioredis";
import { RedisRepositoryError } from "../errors";
import { IRedisRepository } from "../interfaces";
import { RedisRepositoryOptions } from "../types";

const PRIMARY_SOURCE: MetaSource = "RedisSource" as const;

export class RedisRepository<E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>
  implements IRedisRepository<E, O>
{
  private readonly client: Redis;
  private readonly collectionName: string;
  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly logger: ILogger;

  public constructor(options: RedisRepositoryOptions<E>) {
    this.logger = options.logger.child(["RedisRepository", options.target.name]);

    this.kit = new EntityKit({
      target: options.target,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.collectionName = this.kit.getCollectionName(options);
    this.incrementName = this.kit.getIncrementName(options);

    this.client = options.client;

    if (this.kit.metadata.relations.length > 0) {
      this.logger.warn(
        "This version of @lindorm/redis does not support relations. Make sure to handle this manually or keep your eye open for updates.",
      );
    }
  }

  public async setup(): Promise<void> {}

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

    try {
      const clone = await this.kit.clone(entity);

      this.validate(clone);

      const string = new Primitive(clone).toString();

      const key = this.createPrimaryKey(entity);
      const ttl = this.getTTL(entity);

      let result: string | null;

      if (ttl) {
        result = await this.client.setex(key, ttl, string);
      } else {
        result = await this.client.set(key, string);
      }

      const success = result === "OK";

      this.logger.debug("Repository done: clone", {
        input: { key, ttl, entity: clone },
        result: { result, success },
        time: Date.now() - start,
      });

      this.kit.onInsert(clone);

      return clone;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to clone entity", { error });
    }
  }

  public async cloneBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.clone(entity)));
  }

  public async count(predicate: Predicate<E> = {}): Promise<number> {
    const scan = await this.scan(predicate);
    const count = Predicated.filter(scan, predicate).length;

    this.logger.debug("Counted documents", { count, predicate });

    return count;
  }

  public async delete(predicate: Predicate<E>): Promise<void> {
    if (this.kit.metadata.primaryKeys.every((key) => predicate[key])) {
      return this.deleteByKey(predicate);
    }

    const entities = await this.find(predicate);

    for (const entity of entities) {
      await this.destroy(entity);
    }
  }

  public async destroy(entity: E): Promise<void> {
    const start = Date.now();

    try {
      const result = await this.client.del(this.createPrimaryKey(entity));
      const success = result === 1;

      this.logger.debug("Repository done: destroy", {
        entity,
        key: this.createPrimaryKey(entity),
        result,
        success,
        time: Date.now() - start,
      });

      this.kit.onDestroy(entity);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to destroy entity", { error });
    }
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(predicate: Predicate<E>): Promise<boolean> {
    const count = await this.count(predicate);
    const exists = count >= 1;

    this.logger.debug("Repository done: exists", {
      input: { predicate },
      result: { exists },
    });

    if (count > 1) {
      this.logger.warn("Multiple documents found", {
        input: { predicate },
        result: { count },
      });
    }

    return exists;
  }

  public async find(predicate: Predicate<E> = {}): Promise<Array<E>> {
    if (
      this.kit.metadata.primaryKeys.every(
        (key) => predicate[key] && !isObjectLike(predicate[key]),
      )
    ) {
      const entity = await this.findOneByKey(predicate);
      return entity ? [entity] : [];
    }

    const scan = await this.scan(predicate);
    const entities = Predicated.filter(scan, predicate);

    this.logger.debug("Repository done: find", {
      count: entities.length,
      predicate,
      entities,
    });

    return entities;
  }

  public async findOne(predicate: Predicate<E>): Promise<E | null> {
    if (
      this.kit.metadata.primaryKeys.every(
        (key) => predicate[key] && !isObjectLike(predicate[key]),
      )
    ) {
      return await this.findOneByKey(predicate);
    }

    const scan = await this.scan(predicate);
    const entity = Predicated.find(scan, predicate);

    this.logger.debug("Repository done: findOne", { predicate, entity });

    return entity ?? null;
  }

  public async findOneOrFail(predicate: Predicate<E>): Promise<E> {
    const entity = await this.findOne(predicate);

    if (!entity) {
      throw new RedisRepositoryError("Entity not found", { debug: { predicate } });
    }

    return entity;
  }

  public async findOneOrSave(predicate: DeepPartial<E>, options?: O): Promise<E> {
    const entity = await this.findOne(predicate);
    if (entity) return entity;

    return this.save(this.create({ ...predicate, ...options } as O));
  }

  public async insert(entity: O | E): Promise<E> {
    const start = Date.now();

    entity =
      entity instanceof this.kit.metadata.entity.target ? entity : this.create(entity);

    try {
      const insert = await this.kit.insert(entity);

      this.validate(insert);

      const string = new Primitive(insert).toString();

      const key = this.createPrimaryKey(entity);
      const ttl = this.getTTL(entity);

      let result: string | null;

      const found = await this.client.get(key);

      if (found) {
        throw new RedisRepositoryError("Entity already exists", { debug: { key } });
      }

      if (ttl) {
        result = await this.client.setex(key, ttl, string);
      } else {
        result = await this.client.set(key, string);
      }

      const success = result === "OK";

      this.logger.debug("Repository done: insert", {
        input: { key, ttl, entity: insert },
        result: { result, success },
        time: Date.now() - start,
      });

      this.kit.onInsert(insert);

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to save entity", { error });
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
      const found = await this.client.get(this.createPrimaryKey(entity));

      if (found) {
        return await this.update(entity);
      }

      return await this.insert(entity);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError(error.message, { error });
    }
  }

  public async saveBulk(entities: Array<O | E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.save(entity)));
  }

  public async ttl(predicate: Predicate<E>): Promise<number> {
    try {
      const entity = await this.findOneOrFail(predicate);
      return this.client.ttl(this.createPrimaryKey(entity));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to find ttl for entity", { error });
    }
  }

  public async update(entity: E): Promise<E> {
    const start = Date.now();

    try {
      const update = this.kit.update(entity);

      this.validate(entity);

      const string = new Primitive(update).toString();

      const key = this.createPrimaryKey(entity);
      const ttl = this.getTTL(entity);

      let result: string | null;

      await this.validateUpdate(entity);

      if (ttl) {
        result = await this.client.setex(key, ttl, string);
      } else {
        result = await this.client.set(key, string);
      }

      const success = result === "OK";

      this.logger.debug("Repository done: update", {
        input: { key, ttl, entity: update },
        result: { result, success },
        time: Date.now() - start,
      });

      this.kit.onUpdate(update);

      return update;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to save entity", { error });
    }
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.update(entity)));
  }

  // private

  private createPrimaryKey(material: E | Predicate<E>): string {
    const result: Dict<string> = {};

    const primaryKey = this.kit.metadata.columns.find(
      (c) => c.decorator === "PrimaryKeyColumn",
    );

    if (primaryKey) {
      result[primaryKey.key] = material[primaryKey.key];
    } else {
      for (const column of this.kit.metadata.primaryKeys) {
        result[column] = material[column];
      }
    }

    const array = Object.entries(result)
      .sort()
      .map(([k, v]) => `${k}:${v}`);

    const scope = this.getScope(material);

    return `${this.collectionName}${scope}.${array.join(".")}`;
  }

  private async deleteByKey(predicate: Predicate<E>): Promise<void> {
    const start = Date.now();

    try {
      const result = await this.client.del(this.createPrimaryKey(predicate));

      const success = result === 1;

      this.logger.debug("Repository done: deleteByKey", {
        input: { predicate },
        result: { result, success },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Failed to delete entity by key", { error });
    }
  }

  private async findOneByKey(predicate: Predicate<E>): Promise<E | null> {
    const start = Date.now();

    try {
      const result = await this.client.get(this.createPrimaryKey(predicate));

      if (!result) {
        return null;
      }

      const data = new Primitive<E>(result).toJSON();

      this.logger.debug("Repository done: findOneByKey", {
        input: { predicate },
        result: { data },
        time: Date.now() - start,
      });

      return this.create(data);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Failed to find entity by key", { error });
    }
  }

  private async getNextIncrement(key: string): Promise<number> {
    const start = Date.now();
    const name = `${this.incrementName}.${snakeCase(key)}`;

    try {
      const inc = await this.client.incr(name);

      this.logger.silly("Repository done: getNextIncrement", {
        result: {
          collection: this.collectionName,
          increment: this.incrementName,
          key,
          inc,
        },
        time: Date.now() - start,
      });

      return inc;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to get next increment", { error });
    }
  }

  private getScope(material: E | Predicate<E>): string {
    const scope = this.kit.metadata.columns.find((c) => c.decorator === "ScopeColumn");

    if (!scope) return "";

    const string =
      scope && material[scope.key] && !isObjectLike(material[scope.key])
        ? `.${material[scope.key]}`
        : null;

    if (string) return string;

    throw new RedisRepositoryError("Scope predicate missing", {
      debug: { scope },
      details: "Scope predicate is required when scope column is defined",
    });
  }

  private getTTL(entity: E): number | null {
    const expiryDate = this.kit.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );

    if (!expiryDate) return null;
    if (entity[expiryDate.key] === null) return null;

    if (!isDate(entity[expiryDate.key])) {
      throw new RedisRepositoryError("Invalid expiry date on entity", {
        debug: { key: expiryDate.key, value: entity[expiryDate.key] },
      });
    }

    return expiresIn(entity[expiryDate.key]);
  }

  private async scan(predicate: Predicate<E>): Promise<Array<E>> {
    const start = Date.now();

    const keys: Array<string> = [];
    const entities: Array<E> = [];

    const scope = this.getScope(predicate);
    const search = `${this.collectionName}${scope}.*`;

    try {
      let cursor = "0";

      do {
        const reply = await this.client.scan(cursor, "MATCH", search);
        cursor = reply[0];
        keys.push(...reply[1]);
      } while (cursor !== "0");

      for (const key of keys) {
        const result = await this.client.get(key);
        const data = new Primitive<E>(result).toJSON();

        entities.push(this.create(data));
      }

      this.logger.debug("Repository done: scan", {
        count: entities.length,
        time: Date.now() - start,
      });

      return entities;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Failed to scan entities", { error });
    }
  }

  private async validateUpdate(entity: E): Promise<void> {
    if (!this.kit.isPrimarySource) {
      this.logger.debug("Skipping update validation for non-primary source", {
        expect: PRIMARY_SOURCE,
        actual: this.kit.metadata.primarySource,
      });

      return;
    }

    const key = this.createPrimaryKey(entity);
    const exists = await this.client.get(key);

    if (!exists) {
      throw new RedisRepositoryError("Entity not found", { debug: { key } });
    }

    const version = this.kit.metadata.columns.find(
      (c) => c.decorator === "VersionColumn",
    );

    if (version) {
      const found = new Primitive(exists).toJSON();
      if (entity[version.key] !== found[version.key]) {
        throw new RedisRepositoryError("Version mismatch", {
          debug: { key, expect: entity[version.key], actual: found[version.key] },
        });
      }
    }
  }
}
