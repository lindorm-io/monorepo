import { snakeCase } from "@lindorm/case";
import { expiresIn } from "@lindorm/date";
import {
  EntityKit,
  EntityMetadata,
  getJoinCollectionName,
  globalEntityMetadata,
  IEntity,
  MetaRelation,
  MetaSource,
} from "@lindorm/entity";
import { isDate, isObjectLike } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import { Predicated } from "@lindorm/utils";
import { Redis } from "ioredis";
import { RedisRepositoryError } from "../errors";
import { IRedisRepository } from "../interfaces";
import { RedisRepositoryOptions } from "../types";
import { deserializeHash, serializeHash } from "../utils/private";

const PRIMARY_SOURCE: MetaSource = "RedisSource" as const;

export class RedisRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IRedisRepository<E, O> {
  private readonly client: Redis;
  private readonly collectionName: string;
  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly logger: ILogger;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | undefined;
  private readonly parent: Constructor<E> | undefined;
  private readonly separator: string = ":";

  public constructor(options: RedisRepositoryOptions<E>) {
    this.logger = options.logger.child(["RedisRepository", options.target.name]);

    this.kit = new EntityKit({
      target: options.target,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.metadata = globalEntityMetadata.get(options.target);
    this.collectionName = this.kit.getCollectionName({
      ...options,
      separator: this.separator,
    });
    this.incrementName = this.kit.getIncrementName({
      ...options,
      separator: this.separator,
    });
    this.namespace = options.namespace;
    this.parent = options.parent;

    this.client = options.client;
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

      const key = this.createPrimaryKey(clone);
      const ttl = this.getTTL(clone);

      await this.writeHash(key, clone, ttl);

      this.logger.debug("Repository done: clone", {
        input: { key, ttl, entity: clone },
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
      await this.destroyRelations(entity);

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

    entity = entity instanceof this.kit.metadata.target ? entity : this.create(entity);

    try {
      const insert = await this.kit.insert(entity);

      this.validate(insert);

      const key = this.createPrimaryKey(insert);
      const ttl = this.getTTL(insert);

      const found = await this.client.exists(key);

      if (found) {
        throw new RedisRepositoryError("Entity already exists", { debug: { key } });
      }

      await this.writeHash(key, insert, ttl);

      this.logger.debug("Repository done: insert", {
        input: { key, ttl, entity: insert },
        time: Date.now() - start,
      });

      this.kit.onInsert(insert);

      await this.saveRelations(insert, "insert");

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to insert entity", { error });
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
      const found = await this.client.exists(this.createPrimaryKey(entity));

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

      const key = this.createPrimaryKey(entity);
      const ttl = this.getTTL(entity);

      await this.validateUpdate(entity);

      await this.writeHash(key, update, ttl);

      this.logger.debug("Repository done: update", {
        input: { key, ttl, entity: update },
        time: Date.now() - start,
      });

      this.kit.onUpdate(update);

      await this.saveRelations(update, "update");

      return update;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Unable to update entity", { error });
    }
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    return Promise.all(entities.map((entity) => this.update(entity)));
  }

  // private - hash storage

  private async writeHash(key: string, entity: E, ttl: number | null): Promise<void> {
    const document = this.kit.document(entity);
    const hash = serializeHash(document, this.kit.metadata.columns);

    const pipeline = this.client.pipeline();
    pipeline.del(key);
    pipeline.hset(key, hash);
    if (ttl) pipeline.expire(key, ttl);
    await pipeline.exec();
  }

  private async readHash(key: string): Promise<Dict | null> {
    const hash = await this.client.hgetall(key);
    if (!Object.keys(hash).length) return null;
    return deserializeHash(hash, this.kit.metadata.columns);
  }

  // private - relations

  private async destroyRelations(entity: E): Promise<void> {
    if (!this.metadata.relations.length) return;

    for (const relation of this.kit.metadata.relations) {
      if (relation.foreignConstructor() === this.parent) continue;
      if (relation.options.onDestroy !== "cascade") continue;

      if (relation.type === "ManyToMany") {
        const { mirror } = this.commonRelation(relation);
        const targetKeys = this.getTargetFindKeys(relation, mirror);
        const joinKeyName = this.getJoinKeyName(relation);
        const joinSetKey = this.buildJoinSetKey(joinKeyName, relation.findKeys!, entity);

        // Clean up reverse SETs before deleting forward SET
        const members = await this.client.smembers(joinSetKey);
        if (members.length) {
          const reverseMember = this.serializeJoinMember(relation.findKeys!, entity);
          for (const member of members) {
            const targetPredicate = this.deserializeJoinMember(member, targetKeys);
            const reverseSetKey = this.buildJoinSetKey(
              joinKeyName,
              targetKeys,
              targetPredicate as any,
            );
            await this.client.srem(reverseSetKey, reverseMember);
          }
        }

        await this.client.del(joinSetKey);
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
        const { mirror, repository } = this.commonRelation(relation);
        const targetKeys = this.getTargetFindKeys(relation, mirror);

        if (shouldSave) {
          await repository.saveBulk(entity[relation.key] ?? []);
        }

        if (shouldSave || shouldOrphan) {
          const joinKeyName = this.getJoinKeyName(relation);
          const joinSetKey = this.buildJoinSetKey(
            joinKeyName,
            relation.findKeys!,
            entity,
          );

          const desiredMembers = (entity[relation.key] ?? []).map((related: any) =>
            this.serializeJoinMember(targetKeys, related),
          );

          const existingMembers = await this.client.smembers(joinSetKey);

          const toAdd = desiredMembers.filter(
            (m: string) => !existingMembers.includes(m),
          );
          if (toAdd.length) {
            await this.client.sadd(joinSetKey, ...toAdd);
          }

          // Maintain reverse SETs for bidirectional lookup
          const reverseMember = this.serializeJoinMember(relation.findKeys!, entity);
          for (const related of entity[relation.key] ?? []) {
            const reverseSetKey = this.buildJoinSetKey(joinKeyName, targetKeys, related);
            await this.client.sadd(reverseSetKey, reverseMember);
          }

          if (shouldOrphan) {
            const desiredSet = new Set(desiredMembers);
            const toRemove = existingMembers.filter((m) => !desiredSet.has(m));
            if (toRemove.length) {
              await this.client.srem(joinSetKey, ...toRemove);

              // Remove orphaned reverse SET entries
              for (const removedMember of toRemove) {
                const targetPredicate = this.deserializeJoinMember(
                  removedMember,
                  targetKeys,
                );
                const reverseSetKey = this.buildJoinSetKey(
                  joinKeyName,
                  targetKeys,
                  targetPredicate as any,
                );
                await this.client.srem(reverseSetKey, reverseMember);
              }
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

  private async loadRelations(data: Dict): Promise<E> {
    const entity = this.create(data as any);

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
        throw new RedisRepositoryError(`Relation [ ${relation.key} ] cannot be null`, {
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
    repository: RedisRepository<IEntity>,
  ): Promise<Array<IEntity>> {
    const targetKeys = this.getTargetFindKeys(relation, mirror);
    const joinSetKey = this.buildJoinSetKey(
      this.getJoinKeyName(relation),
      relation.findKeys!,
      entity,
    );

    const members = await this.client.smembers(joinSetKey);
    if (!members.length) return [];

    const isSelfReferencing =
      relation.key === mirror.key && relation.foreignKey === mirror.foreignKey;

    const results = await Promise.all(
      members.map((member) => {
        const predicate = this.deserializeJoinMember(member, targetKeys);
        return repository.findOne(predicate);
      }),
    );

    const entities: Array<IEntity> = [];

    for (const found of results) {
      if (found) {
        if (!isSelfReferencing) {
          (found as any)[mirror.key] = entity;
        }
        entities.push(found);
      }
    }

    return entities;
  }

  private commonRelation(relation: MetaRelation): {
    mirror: MetaRelation;
    repository: RedisRepository<IEntity>;
  } {
    const repository = new RedisRepository({
      target: relation.foreignConstructor(),
      parent: this.kit.target,
      client: this.client,
      logger: this.logger,
      namespace: this.namespace,
    });

    const mirror = repository.kit.metadata.relations.find(
      (r) => r.key === relation.foreignKey,
    );

    if (!mirror) {
      throw new RedisRepositoryError("Mirror relation not found", {
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

  private getJoinKeyName(relation: MetaRelation): string {
    return getJoinCollectionName(relation.joinTable as string, {
      namespace: this.metadata.entity.namespace,
      separator: this.separator,
    });
  }

  private buildJoinSetKey(
    baseName: string,
    findKeys: Dict<string>,
    entity: E | IEntity,
  ): string {
    const parts = Object.entries(findKeys)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([joinCol, entityCol]) => `${joinCol}:${(entity as any)[entityCol]}`);
    return `${baseName}${this.separator}${parts.join(this.separator)}`;
  }

  private serializeJoinMember(targetKeys: Dict<string>, related: IEntity): string {
    return Object.entries(targetKeys)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([joinCol, entityCol]) => {
        const value = (related as any)[entityCol];
        if (value == null) {
          throw new RedisRepositoryError("Cannot serialize join member with null key", {
            debug: { joinCol, entityCol, value },
          });
        }
        return `${joinCol}:${value}`;
      })
      .join(".");
  }

  private deserializeJoinMember(member: string, targetKeys: Dict<string>): Dict {
    const sortedEntries = Object.entries(targetKeys).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const parts = member.split(".");
    const predicate: Dict = {};

    for (let i = 0; i < sortedEntries.length; i++) {
      const [, entityCol] = sortedEntries[i];
      const part = parts[i];
      const colonIdx = part.indexOf(":");
      predicate[entityCol] = part.substring(colonIdx + 1);
    }

    return predicate;
  }

  private serializePrimaryKey(
    repository: RedisRepository<IEntity>,
    entity: IEntity,
  ): string {
    return repository.metadata.primaryKeys.map((k) => String(entity[k])).join("|");
  }

  // private - key management

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

    return `${this.collectionName}${scope}${this.separator}${array.join(this.separator)}`;
  }

  private async deleteByKey(predicate: Predicate<E>): Promise<void> {
    const start = Date.now();

    try {
      const entity = await this.findOneByKey(predicate);
      if (entity) {
        await this.destroyRelations(entity);
      }

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
      const data = await this.readHash(this.createPrimaryKey(predicate));

      if (!data) {
        return null;
      }

      this.logger.debug("Repository done: findOneByKey", {
        input: { predicate },
        result: { data },
        time: Date.now() - start,
      });

      return await this.loadRelations(data);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new RedisRepositoryError("Failed to find entity by key", { error });
    }
  }

  private async getNextIncrement(key: string): Promise<number> {
    const start = Date.now();
    const name = `${this.incrementName}${this.separator}${snakeCase(key)}`;

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
        ? `${this.separator}${material[scope.key]}`
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

    try {
      const scope = this.getScope(predicate);
      const search = `${this.collectionName}${scope}${this.separator}*`;

      // Build pre-filter: simple equality fields we can check via HMGET
      const filterEntries: Array<{ key: string; expected: string }> = [];

      for (const [key, value] of Object.entries(predicate)) {
        if (value === undefined || value === null || isObjectLike(value)) continue;
        const column = this.kit.metadata.columns.find((c) => c.key === key);
        const serialized = serializeHash({ [key]: value }, column ? [column] : []);
        if (serialized[key] !== undefined) {
          filterEntries.push({ key, expected: serialized[key] });
        }
      }
      let cursor = "0";

      do {
        const reply = await this.client.scan(cursor, "MATCH", search);
        cursor = reply[0];
        keys.push(...reply[1]);
      } while (cursor !== "0");

      for (const key of keys) {
        // Pre-filter using HMGET when we have simple equality fields
        if (filterEntries.length) {
          const fieldNames = filterEntries.map((f) => f.key);
          const values = await this.client.hmget(key, ...fieldNames);

          let match = true;
          for (let i = 0; i < filterEntries.length; i++) {
            if (values[i] !== filterEntries[i].expected) {
              match = false;
              break;
            }
          }

          if (!match) continue;
        }

        const data = await this.readHash(key);
        if (data) {
          entities.push(await this.loadRelations(data));
        }
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
    const exists = await this.client.exists(key);

    if (!exists) {
      throw new RedisRepositoryError("Entity not found", { debug: { key } });
    }

    const version = this.kit.metadata.columns.find(
      (c) => c.decorator === "VersionColumn",
    );

    if (version) {
      const stored = await this.client.hget(key, version.key);
      if (stored !== null && entity[version.key] !== parseInt(stored, 10)) {
        throw new RedisRepositoryError("Version mismatch", {
          debug: {
            key,
            expect: entity[version.key],
            actual: parseInt(stored, 10),
          },
        });
      }
    }
  }
}
