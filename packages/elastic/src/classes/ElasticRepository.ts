import { Client } from "@elastic/elasticsearch";
import {
  MappingTypeMapping,
  QueryDslBoolQuery,
  SearchHit,
} from "@elastic/elasticsearch/lib/api/types";
import { snakeCase } from "@lindorm/case";
import { isAfter } from "@lindorm/date";
import { IEntityBase } from "@lindorm/entity";
import { isArray, isDate, isFunction, isNumber, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ElasticRepositoryError } from "../errors";
import { IElasticRepository } from "../interfaces";
import {
  CreateElasticEntityFn,
  ElasticEntityConfig,
  ElasticRepositoryOptions,
  ValidateElasticEntityFn,
} from "../types";

export class ElasticRepository<
  E extends IEntityBase,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IElasticRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly client: Client;
  private readonly config: ElasticEntityConfig<E>;
  private readonly createFn: CreateElasticEntityFn<E> | undefined;
  private readonly index: string;
  private readonly logger: ILogger;
  private readonly mappings: MappingTypeMapping;
  private readonly validateFn: ValidateElasticEntityFn<E> | undefined;

  public constructor(options: ElasticRepositoryOptions<E>) {
    this.logger = options.logger.child(["ElasticRepository", options.Entity.name]);

    this.EntityConstructor = options.Entity;
    this.client = options.client;
    this.config = options.config ?? {};
    this.index = ElasticRepository.createIndexName(options);
    this.mappings = {
      ...(options.mappings ?? {}),
      properties: {
        ...(options.mappings?.properties ?? {}),
        createdAt: { type: "date" },
        updatedAt: { type: "date" },
      },
    };

    this.createFn = options.create;
    this.validateFn = options.validate;
  }

  // public static

  public static createEntity<
    E extends IEntityBase,
    O extends DeepPartial<E> = DeepPartial<E>,
  >(Entity: Constructor<E>, options: O | E): E {
    const entity = new Entity(options);

    const { id, createdAt, updatedAt, ...rest } = options as E;

    entity.id = id ?? entity.id ?? randomUUID();

    entity.createdAt =
      ElasticRepository.date(createdAt) ??
      ElasticRepository.date(entity.createdAt) ??
      new Date();

    entity.updatedAt =
      ElasticRepository.date(updatedAt) ??
      ElasticRepository.date(entity.updatedAt) ??
      new Date();

    for (const [key, value] of Object.entries(rest)) {
      if (key === "_id") continue;
      entity[key as keyof E] = (value ?? null) as E[keyof E];
    }

    for (const [key, value] of Object.entries(entity)) {
      if (value !== undefined) continue;
      entity[key as keyof E] = null as E[keyof E];
    }

    return entity;
  }

  // public

  public create(options: O | E = {} as O): E {
    const entity = this.createFn
      ? this.createFn(options)
      : ElasticRepository.createEntity(this.EntityConstructor, options);

    if (this.config.deleteAttribute && !isDate(entity[this.config.deleteAttribute])) {
      entity[this.config.deleteAttribute] = ElasticRepository.date(
        entity[this.config.deleteAttribute],
      ) as any;
    }

    if (
      this.config.primaryTermAttribute &&
      !isNumber(entity[this.config.primaryTermAttribute])
    ) {
      entity[this.config.primaryTermAttribute] = 0 as any;
    }

    if (
      this.config.revisionAttribute &&
      !isNumber(entity[this.config.revisionAttribute])
    ) {
      entity[this.config.revisionAttribute] = 0 as any;
    }

    if (
      this.config.sequenceAttribute &&
      !isNumber(entity[this.config.sequenceAttribute])
    ) {
      entity[this.config.sequenceAttribute] = 0 as any;
    }

    if (this.config.ttlAttribute && !isDate(entity[this.config.ttlAttribute])) {
      entity[this.config.ttlAttribute] = ElasticRepository.date(
        entity[this.config.ttlAttribute],
      ) as any;
    }

    this.logger.debug("Created entity", { entity });

    this.validateEntity(entity);

    return entity;
  }

  public async setup(): Promise<void> {
    this.logger.debug("Setting up index", { index: this.index });

    try {
      await this.client.indices.get({ index: this.index });

      this.logger.debug("Index already exists", { index: this.index });

      return;
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        throw new ElasticRepositoryError("Failed to get index", { error });
      }
    }

    this.logger.debug("Creating new index", { index: this.index });

    await this.client.indices.create({
      index: this.index,
      mappings: this.mappings,
    });

    this.logger.debug("Index created", { index: this.index });
  }

  public async count(query?: QueryDslBoolQuery): Promise<number> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.count({
        index: this.index,
        query: { bool },
      });

      this.logger.debug("Repository done: count", {
        input: {
          query,
        },
        result: {
          count: result.count,
          shards: result._shards,
        },
        time: Date.now() - start,
      });

      return result.count;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to count entities", { error });
    }
  }

  public async delete(query: QueryDslBoolQuery): Promise<void> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.deleteByQuery({
        index: this.index,
        query: { bool },
      });

      if (!result.total) {
        throw new ElasticRepositoryError("Failed to delete entities", {
          debug: { result },
        });
      }

      await this.client.indices.refresh({ index: this.index });

      this.logger.debug("Repository done: delete", {
        input: {
          query,
        },
        result: {
          deleted: result.deleted,
          failures: result.failures,
          total: result.total,
        },
        time: Date.now() - start,
      });

      return;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to delete entities", { error });
    }
  }

  public async deleteById(id: string): Promise<void> {
    const start = Date.now();

    try {
      const result = await this.client.delete({
        refresh: "wait_for",
        index: this.index,
        id,
      });

      if (result.result !== "deleted") {
        throw new ElasticRepositoryError("Failed to delete entity", {
          debug: { result },
        });
      }

      this.logger.debug("Repository done: deleteById", {
        input: {
          id,
        },
        result: {
          id: result._id,
          message: result.result,
          primaryTerm: result._primary_term,
          seqNo: result._seq_no,
          shards: result._shards,
          version: result._version,
        },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Unable to destroy entity", { error });
    }
  }

  public async deleteExpired(): Promise<void> {
    const start = Date.now();

    try {
      if (!this.config.ttlAttribute) {
        this.logger.debug("Expiry is not enabled; no action taken on deleteExpired");
        return;
      }

      const query: QueryDslBoolQuery = {
        must: [
          {
            range: {
              [this.config.ttlAttribute]: { lte: "now" },
            },
          },
        ],
      };

      const result = await this.client.deleteByQuery({
        index: this.index,
        query: { bool: query },
      });

      await this.client.indices.refresh({ index: this.index });

      this.logger.debug("Repository done: deleteExpired", {
        input: {
          query,
        },
        result: {
          deleted: result.deleted,
          failures: result.failures,
          total: result.total,
        },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to delete expired entities", { error });
    }
  }

  public async destroy(entity: E): Promise<void> {
    await this.deleteById(entity.id);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    await Promise.all(entities.map((entity) => this.destroy(entity)));
  }

  public async exists(query: QueryDslBoolQuery): Promise<boolean> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.search<any>({
        index: this.index,
        query: { bool },
        size: 1,
      });

      this.logger.debug("Repository done: exists", {
        input: {
          query,
        },
        result: {
          hits: result.hits.hits.length,
          shards: result._shards,
          timedOut: result.timed_out,
          took: result.took,
        },
        time: Date.now() - start,
      });

      return result.hits.hits.length > 0;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to check if entity exists", { error });
    }
  }

  public async find(query?: QueryDslBoolQuery): Promise<Array<E>> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.search<any>({
        index: this.index,
        query: { bool },
        seq_no_primary_term: true,
        version: true,
      });

      this.logger.debug("Repository done: find", {
        input: {
          query,
        },
        result: {
          hits: result.hits.hits.length,
          shards: result._shards,
          timedOut: result.timed_out,
          took: result.took,
        },
        time: Date.now() - start,
      });

      return result.hits.hits.map(this.handleHit.bind(this));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to find entities", { error });
    }
  }

  public async findOne(query: QueryDslBoolQuery): Promise<E | null> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.search<any>({
        index: this.index,
        query: { bool },
        seq_no_primary_term: true,
        size: 1,
        version: true,
      });

      if (result.hits.hits.length === 0) {
        return null;
      }

      this.logger.debug("Repository done: findOne", {
        input: {
          query,
        },
        result: {
          shards: result._shards,
          timedOut: result.timed_out,
          took: result.took,
        },
        time: Date.now() - start,
      });

      return this.handleHit(result.hits.hits[0]);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to find entity", { error });
    }
  }

  public async findOneOrFail(query: QueryDslBoolQuery): Promise<E> {
    const entity = await this.findOne(query);

    if (!entity) {
      throw new ElasticRepositoryError("Entity not found", { debug: { query } });
    }

    return entity;
  }

  public async findOneOrSave(query: QueryDslBoolQuery, options?: O): Promise<E> {
    const entity = await this.findOne(query);
    if (entity) return entity;

    return this.insert(this.create(options));
  }

  public async findOneById(id: string): Promise<E | null> {
    const start = Date.now();

    try {
      const result = await this.client.get<any>({ index: this.index, id });

      this.logger.debug("Repository done: findOneById", {
        input: {
          id,
        },
        result: {
          id: result._id,
          primaryTerm: result._primary_term,
          seq: result._seq_no,
          version: result._version,
        },
        time: Date.now() - start,
      });

      const document = this.handleHit(result);

      if (
        this.config.ttlAttribute &&
        isDate(document[this.config.ttlAttribute]) &&
        isAfter(document[this.config.ttlAttribute] as Date, new Date())
      ) {
        return null;
      }

      if (this.config.deleteAttribute && document[this.config.deleteAttribute]) {
        return null;
      }

      return document;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }

      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to find entity by id", { error });
    }
  }

  public async findOneByIdOrFail(id: string): Promise<E> {
    const entity = await this.findOneById(id);

    if (!entity) {
      throw new ElasticRepositoryError("Entity not found", { debug: { id } });
    }

    return entity;
  }

  public async insert(entity: E): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    const updated = this.updateEntityData(entity);

    try {
      const { id, ...body } = updated;

      if (this.config.revisionAttribute) {
        delete body[this.config.revisionAttribute as keyof Omit<E, "id">];
      }

      if (this.config.sequenceAttribute) {
        delete body[this.config.sequenceAttribute as keyof Omit<E, "id">];
      }

      const result = await this.client.index({
        refresh: "wait_for",
        index: this.index,
        id,
        body,
      });

      if (result.result !== "created") {
        throw new ElasticRepositoryError("Failed to create entity", {
          debug: { result },
        });
      }

      this.logger.debug("Repository done: insert", {
        input: {
          entity,
        },
        result: {
          id: result._id,
          message: result.result,
          primaryTerm: result._primary_term,
          version: result._version,
          seqNo: result._seq_no,
        },
        time: Date.now() - start,
      });

      const get = await this.client.get<any>({ index: this.index, id });

      return this.handleHit(get);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<E>): Promise<Array<E>> {
    const start = Date.now();

    const actions: Array<any> = [];

    for (const entity of entities) {
      this.validateEntity(entity);

      const updated = this.updateEntityData(entity);
      const { id, ...doc } = updated;

      if (this.config.revisionAttribute) {
        delete doc[this.config.revisionAttribute as keyof Omit<E, "id">];
      }

      if (this.config.sequenceAttribute) {
        delete doc[this.config.sequenceAttribute as keyof Omit<E, "id">];
      }

      actions.push({ index: { _index: this.index, _id: id } });
      actions.push(doc);
    }

    try {
      const result = await this.client.bulk({
        refresh: "wait_for",
        body: actions,
      });

      if (result.errors) {
        throw new ElasticRepositoryError("Failed to bulk insert entities", {
          debug: { result },
        });
      }

      this.logger.debug("Repository done: insertBulk", {
        input: {
          actions,
        },
        result,
        time: Date.now() - start,
      });

      const search = await this.client.search<any>({
        index: this.index,
        query: {
          bool: { must: [{ terms: { _id: entities.map((entity) => entity.id) } }] },
        },
        seq_no_primary_term: true,
        version: true,
      });

      return entities
        .map((e) => search.hits.hits.find((h) => h._id === e.id))
        .map((h) => this.handleHit(h!));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to bulk insert entities", { error });
    }
  }

  public async save(entity: E): Promise<E> {
    if (this.config.revisionAttribute) {
      if (entity[this.config.revisionAttribute] === 0) {
        return this.insert(entity);
      }
      return this.update(entity);
    }

    try {
      return this.insert(entity);
    } catch (_) {
      return this.update(entity);
    }
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    if (this.config.revisionAttribute) {
      const toInsert = entities.filter(
        (e) => (e[this.config.revisionAttribute as keyof E] as number) === 0,
      );
      const inserted = toInsert.length ? await this.insertBulk(toInsert) : [];

      const toUpdate = entities.filter(
        (e) => (e[this.config.revisionAttribute as keyof E] as number) !== 0,
      );
      const updated = toUpdate.length ? await this.updateBulk(toUpdate) : [];

      return entities.map(
        (entity) =>
          inserted.find((e) => e.id === entity.id) ??
          updated.find((e) => e.id === entity.id) ??
          entity,
      );
    }

    return Promise.all(entities.map((e) => this.save(e)));
  }

  public async softDelete(query: QueryDslBoolQuery): Promise<void> {
    const start = Date.now();

    if (!this.config.deleteAttribute) {
      throw new ElasticRepositoryError("Soft delete is not enabled");
    }

    const softDelete = this.config.deleteAttribute.toString();

    try {
      const result = await this.client.updateByQuery({
        index: this.index,
        body: {
          script: {
            source: `ctx._source.${softDelete} = params.${softDelete}`,
            params: { [softDelete]: new Date().toISOString() },
          },
          query: { bool: query },
        },
      });

      await this.client.indices.refresh({ index: this.index });

      this.logger.debug("Repository done: softDelete", {
        input: {
          query,
        },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to soft delete entities", { error });
    }
  }

  public async softDeleteById(id: string): Promise<void> {
    const start = Date.now();

    if (!this.config.deleteAttribute) {
      throw new ElasticRepositoryError("Soft delete is not enabled");
    }

    const softDelete = this.config.deleteAttribute.toString();

    try {
      const result = await this.client.update({
        refresh: "wait_for",
        index: this.index,
        id,
        body: {
          script: {
            source: `ctx._source.${softDelete} = params.${softDelete}`,
            params: { [softDelete]: new Date().toISOString() },
          },
        },
      });

      this.logger.debug("Repository done: softDeleteById", {
        input: {
          id,
        },
        result: {
          id: result._id,
          message: result.result,
          primaryTerm: result._primary_term,
          seqNo: result._seq_no,
          shards: result._shards,
          version: result._version,
        },
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to soft delete entity", { error });
    }
  }

  public async softDestroy(entity: E): Promise<void> {
    await this.softDeleteById(entity.id);
  }

  public async softDestroyBulk(entities: Array<E>): Promise<void> {
    await this.softDelete({
      must: [{ terms: { _id: entities.map((entity) => entity.id) } }],
    });
  }

  public async update(entity: E): Promise<E> {
    const start = Date.now();

    this.validateEntity(entity);

    const filter = this.defaultUpdateFilter(entity);
    const updated = this.updateEntityData(entity);

    try {
      const { id, ...doc } = updated;

      if (this.config.primaryTermAttribute) {
        delete doc[this.config.primaryTermAttribute as keyof Omit<E, "id">];
      }

      if (this.config.revisionAttribute) {
        delete doc[this.config.revisionAttribute as keyof Omit<E, "id">];
      }

      if (this.config.sequenceAttribute) {
        delete doc[this.config.sequenceAttribute as keyof Omit<E, "id">];
      }

      const result = await this.client.update({
        refresh: "wait_for",
        index: this.index,
        id,
        ...(this.config.primaryTermAttribute && {
          if_primary_term: updated[this.config.primaryTermAttribute] as number,
        }),
        ...(this.config.sequenceAttribute && {
          if_seq_no: updated[this.config.sequenceAttribute] as number,
        }),
        body: { doc },
      });

      if (result.result !== "updated") {
        throw new ElasticRepositoryError("Failed to update entity", {
          debug: { result },
        });
      }

      this.logger.debug("Repository done: updateEntity", {
        input: {
          filter,
          updated,
        },
        result: {
          id: result._id,
          message: result.result,
          primaryTerm: result._primary_term,
          seqNo: result._seq_no,
          shards: result._shards,
          version: result._version,
        },
        time: Date.now() - start,
      });

      return this.create({
        ...updated,
        id: result._id,
        ...(this.config.primaryTermAttribute && {
          [this.config.primaryTermAttribute]: result._primary_term,
        }),
        ...(this.config.revisionAttribute && {
          [this.config.revisionAttribute]: result._version,
        }),
        ...(this.config.sequenceAttribute && {
          [this.config.sequenceAttribute]: result._seq_no,
        }),
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Unable to update entity", { error });
    }
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    const start = Date.now();

    const actions: Array<any> = [];

    for (const entity of entities) {
      this.validateEntity(entity);

      const updated = this.updateEntityData(entity);
      const { id, ...doc } = updated;

      if (this.config.primaryTermAttribute) {
        delete doc[this.config.primaryTermAttribute as keyof Omit<E, "id">];
      }

      if (this.config.revisionAttribute) {
        delete doc[this.config.revisionAttribute as keyof Omit<E, "id">];
      }

      if (this.config.sequenceAttribute) {
        delete doc[this.config.sequenceAttribute as keyof Omit<E, "id">];
      }

      actions.push({
        update: {
          _index: this.index,
          _id: id,
          ...(this.config.primaryTermAttribute && {
            if_primary_term: updated[this.config.primaryTermAttribute] as number,
          }),
          ...(this.config.sequenceAttribute && {
            if_seq_no: updated[this.config.sequenceAttribute] as number,
          }),
        },
      });
      actions.push({ doc });
    }

    try {
      const result = await this.client.bulk({
        refresh: "wait_for",
        body: actions,
      });

      if (result.errors) {
        throw new ElasticRepositoryError("Failed to bulk update entities", {
          debug: { result },
        });
      }

      this.logger.debug("Repository done: updateBulk", {
        input: {
          actions,
        },
        result,
        time: Date.now() - start,
      });

      const search = await this.client.search<any>({
        index: this.index,
        query: {
          bool: { must: [{ terms: { _id: entities.map((entity) => entity.id) } }] },
        },
        seq_no_primary_term: true,
        version: true,
      });

      return entities
        .map((e) => search.hits.hits.find((h) => h._id === e.id))
        .map((h) => this.handleHit(h!));
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to bulk update entities", { error });
    }
  }

  public async ttl(query: QueryDslBoolQuery): Promise<number> {
    const start = Date.now();

    const bool = this.defaultFindFilter(query);

    try {
      const result = await this.client.search<any>({
        index: this.index,
        query: { bool },
        size: 1,
      });

      if (!result.hits.hits.length) {
        throw new ElasticRepositoryError("Entity not found", { debug: { query } });
      }

      this.logger.debug("Repository done: ttl", {
        input: {
          query,
        },
        result: {
          hits: result.hits.hits.length,
          shards: result._shards,
          timedOut: result.timed_out,
          took: result.took,
        },
        time: Date.now() - start,
      });

      const entity = this.handleHit(result.hits.hits[0]);

      if (!this.config.ttlAttribute || !isDate(entity[this.config.ttlAttribute])) {
        throw new ElasticRepositoryError("Entity does not have ttl", {
          debug: { entity },
        });
      }

      return Math.round(
        ((entity[this.config.ttlAttribute] as Date).getTime() - Date.now()) / 1000,
      );
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to get ttl for entity", { error });
    }
  }

  public async ttlById(id: string): Promise<number> {
    const start = Date.now();

    try {
      const result = await this.client.get<any>({ index: this.index, id });

      this.logger.debug("Repository done: ttlById", {
        input: {
          id,
        },
        result: {
          id: result._id,
          version: result._version,
        },
        time: Date.now() - start,
      });

      const entity = this.handleHit(result);

      if (!this.config.ttlAttribute || !isDate(entity[this.config.ttlAttribute])) {
        throw new ElasticRepositoryError("Entity does not have ttl", {
          debug: { entity },
        });
      }

      return Math.round(
        ((entity[this.config.ttlAttribute] as Date).getTime() - Date.now()) / 1000,
      );
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to get ttl for entity", { error });
    }
  }

  // private

  private static createIndexName<E extends IEntityBase>(
    options: ElasticRepositoryOptions<E>,
  ): string {
    const baseName = snakeCase(options.Entity.name);
    const namespace = options.namespace ? `${snakeCase(options.namespace)}_` : "";
    return `${namespace}${baseName}`;
  }

  private defaultFindFilter(query: QueryDslBoolQuery = {}): QueryDslBoolQuery {
    const mustNot: Array<any> = [];

    if (query.must_not) {
      mustNot.push(...(isArray(query.must_not) ? query.must_not : [query.must_not]));
    }

    if (this.config.ttlAttribute) {
      mustNot.push({
        range: { [this.config.ttlAttribute]: { lte: new Date().toISOString() } },
      });
    }

    if (this.config.deleteAttribute) {
      mustNot.push({ exists: { field: this.config.deleteAttribute } });
    }

    return { ...query, must_not: mustNot };
  }

  private defaultUpdateFilter(entity: E): QueryDslBoolQuery {
    const result: QueryDslBoolQuery = {
      must: [{ term: { id: entity.id } }],
    };

    result.must_not = [];

    if (this.config.ttlAttribute) {
      result.must_not.push({
        range: { [this.config.ttlAttribute]: { lte: "now" } },
      });
    }

    if (this.config.deleteAttribute) {
      result.must_not.push({
        exists: { field: this.config.deleteAttribute.toString() },
      });
    }

    return result;
  }

  private static date(date?: any): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (isString(date)) return new Date(date);

    return null;
  }

  private handleHit(hit: SearchHit<any>): E {
    return this.create({
      ...hit._source,
      id: hit._id,
      ...(this.config.primaryTermAttribute && {
        [this.config.primaryTermAttribute]: hit._primary_term,
      }),
      ...(this.config.revisionAttribute && {
        [this.config.revisionAttribute]: hit._version,
      }),
      ...(this.config.sequenceAttribute && {
        [this.config.sequenceAttribute]: hit._seq_no,
      }),
    });
  }

  private updateEntityData(entity: E): E {
    const updated = this.create(entity);

    updated.updatedAt = new Date();

    return updated;
  }

  private validateBaseEntity(entity: E): void {
    z.object({
      id: z.string().uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }).parse({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private validateEntity(entity: E): void {
    this.validateBaseEntity(entity);

    if (isFunction(this.validateFn)) {
      const { id, createdAt, updatedAt, ...rest } = entity;

      this.validateFn(rest);
    }

    this.logger.silly("Entity validated", { entity });
  }
}
