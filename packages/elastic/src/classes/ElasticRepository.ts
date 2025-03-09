import { Client } from "@elastic/elasticsearch";
import {
  MappingTypeMapping,
  QueryDslBoolQuery,
  QueryDslQueryContainer,
  SearchHit,
} from "@elastic/elasticsearch/lib/api/types";
import { ms, ReadableTime } from "@lindorm/date";
import {
  EntityKit,
  EntityMetadata,
  globalEntityMetadata,
  IEntity,
  MetaSource,
} from "@lindorm/entity";
import { isArray } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { ElasticRepositoryError } from "../errors";
import { IElasticRepository } from "../interfaces";
import { ElasticRepositoryOptions } from "../types";
import { getMapping } from "../utils";

const PRIMARY_SOURCE: MetaSource = "elastic" as const;

export class ElasticRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IElasticRepository<E, O>
{
  private readonly EntityConstructor: Constructor<E>;
  private readonly client: Client;
  private readonly indexName: string;
  private readonly incrementName: string;
  private readonly kit: EntityKit<E, O>;
  private readonly logger: ILogger;
  private readonly mapping: MappingTypeMapping;
  private readonly metadata: EntityMetadata;

  public constructor(options: ElasticRepositoryOptions<E>) {
    this.logger = options.logger.child(["ElasticRepository", options.Entity.name]);

    this.kit = new EntityKit({
      Entity: options.Entity,
      logger: this.logger,
      source: PRIMARY_SOURCE,
      getNextIncrement: this.getNextIncrement.bind(this),
    });

    this.client = options.client;
    this.metadata = globalEntityMetadata.get(options.Entity);
    this.indexName = this.kit.getCollectionName(options);
    this.incrementName = this.kit.getIncrementName(options);
    this.mapping = getMapping(this.metadata);

    this.EntityConstructor = options.Entity;
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

  public async setup(): Promise<void> {
    await this.waitForElastic();

    const options = [{ indexName: this.indexName, mapping: this.mapping }];
    const metadata = this.metadata.generated.filter((g) => g.strategy === "increment");

    if (metadata.length) {
      options.push({
        indexName: this.incrementName,
        mapping: { properties: { key: { type: "text" }, value: { type: "long" } } },
      });
    }

    for (const config of options) {
      this.logger.debug("Configuring index", { index: config.indexName });

      try {
        await this.client.indices.get({ index: config.indexName, master_timeout: "60s" });

        this.logger.debug("Writing mapping to index", { index: config.indexName });

        await this.client.indices.putMapping({
          index: config.indexName,
          body: config.mapping,
        });

        return;
      } catch (error: any) {
        if (error.meta?.statusCode !== 404) {
          throw new ElasticRepositoryError("Failed to get index", { error });
        }
      }

      this.logger.debug("Creating new index", { index: config.indexName });

      await this.client.indices.create({
        index: config.indexName,
        mappings: config.mapping,
      });
    }
  }

  public async clone(entity: E): Promise<E> {
    const start = Date.now();

    const clone = await this.kit.clone(entity);

    this.validate(clone);

    try {
      const result = await this.client.index({
        index: this.indexName,
        body: clone,
        refresh: "wait_for",
      });

      this.logger.debug("Repository done: clone", {
        input: { entity },
        result: {
          id: result._id,
          message: result.result,
          primaryTerm: result._primary_term,
          version: result._version,
          seqNo: result._seq_no,
        },
        time: Date.now() - start,
      });

      this.kit.onInsert(clone);

      return clone;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to clone entity", { error });
    }
  }

  public async cloneBulk(entities: Array<E>): Promise<Array<E>> {
    const result: Array<E> = [];
    for (const entity of entities) {
      result.push(await this.clone(entity));
    }
    return result;
  }

  public async count(query?: QueryDslBoolQuery): Promise<number> {
    const start = Date.now();

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.count({
        index: this.indexName,
        query: { bool },
      });

      this.logger.debug("Repository done: count", {
        input: { query },
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

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.deleteByQuery({
        index: this.indexName,
        query: { bool },
      });

      if (!result.total) {
        throw new ElasticRepositoryError("Failed to delete entities", {
          debug: { result },
        });
      }

      await this.client.indices.refresh({ index: this.indexName });

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

  public async deleteExpired(): Promise<void> {
    const start = Date.now();

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (!expiryDate) {
      throw new ElasticRepositoryError("ExpiryDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    try {
      const bool: QueryDslBoolQuery = {
        must: [{ range: { [expiryDate.key]: { lte: "now" } } }],
      };

      const result = await this.client.deleteByQuery({
        index: this.indexName,
        query: { bool },
      });

      await this.client.indices.refresh({ index: this.indexName });

      this.logger.debug("Repository done: deleteExpired", {
        input: {
          query: { bool },
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
    const [primaryKey] = this.metadata.primaryKeys;

    await this.delete({
      must: [{ terms: { _id: entity[primaryKey] } }],
    });

    this.kit.onDestroy(entity);
  }

  public async destroyBulk(entities: Array<E>): Promise<void> {
    for (const entity of entities) {
      await this.destroy(entity);
    }
  }

  public async exists(query: QueryDslBoolQuery): Promise<boolean> {
    const start = Date.now();

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.search<any>({
        index: this.indexName,
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

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.search<any>({
        index: this.indexName,
        query: { bool },
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

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.search<any>({
        index: this.indexName,
        query: { bool },
        size: 1,
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

  public async insert(entity: E): Promise<E> {
    const start = Date.now();

    const insert = await this.kit.insert(entity);

    this.validate(insert);

    try {
      const [primaryKey] = this.metadata.primaryKeys;

      const result = await this.client.index({
        index: this.indexName,
        id: insert[primaryKey],
        body: insert,
        refresh: "wait_for",
      });

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

      this.kit.onInsert(insert);

      return insert;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to insert entity", { error });
    }
  }

  public async insertBulk(entities: Array<E>): Promise<Array<E>> {
    const result: Array<E> = [];
    for (const entity of entities) {
      result.push(await this.insert(entity));
    }
    return result;
  }

  public async save(entity: E): Promise<E> {
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
      return this.insert(entity);
    } catch (err: any) {
      if (err.code === 11000) {
        return this.update(entity);
      }
      throw err;
    }
  }

  public async saveBulk(entities: Array<E>): Promise<Array<E>> {
    const result: Array<E> = [];
    for (const entity of entities) {
      result.push(await this.save(entity));
    }
    return result;
  }

  public async softDelete(query: QueryDslBoolQuery): Promise<void> {
    const start = Date.now();

    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (!deleteDate) {
      throw new ElasticRepositoryError("DeleteDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    try {
      const result = await this.client.updateByQuery({
        index: this.indexName,
        body: {
          script: {
            source: `ctx._source.${deleteDate.key} = params.${deleteDate.key}`,
            params: { [deleteDate.key]: new Date().toISOString() },
          },
          query: { bool: query },
        },
      });

      await this.client.indices.refresh({ index: this.indexName });

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

  public async softDestroy(entity: E): Promise<void> {
    const [primaryKey] = this.metadata.primaryKeys;

    await this.softDelete({
      must: [{ terms: { _id: entity[primaryKey] } }],
    });
  }

  public async softDestroyBulk(entities: Array<E>): Promise<void> {
    const [primaryKey] = this.metadata.primaryKeys;

    await this.softDelete({
      must: [{ terms: { _id: entities.map((entity) => entity[primaryKey]) } }],
    });
  }

  public async ttl(query: QueryDslBoolQuery): Promise<number> {
    const start = Date.now();

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (!expiryDate) {
      throw new ElasticRepositoryError("ExpiryDate column not found", {
        debug: { metadata: this.metadata },
      });
    }

    const bool = this.createDefaultQuery(query);

    try {
      const result = await this.client.search<any>({
        index: this.indexName,
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

      return Math.round(((entity[expiryDate.key] as Date).getTime() - Date.now()) / 1000);
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to get ttl for entity", { error });
    }
  }

  public async update(entity: E): Promise<E> {
    const start = Date.now();

    const query = this.createUpdateQuery(entity);
    const update = this.kit.update(entity);
    const set = this.kit.removeReadonly(update);

    this.validate(update);

    try {
      const result = await this.client.updateByQuery({
        index: this.indexName,
        body: {
          script: {
            source: Object.keys(set)
              .map((key) => `ctx._source.${key} = params.${key}`)
              .join("; "),
            params: set,
          },
          query: { bool: query },
        },
      });

      await this.client.indices.refresh({ index: this.indexName });

      this.logger.debug("Repository done: updateEntity", {
        input: {
          query,
          update,
        },
        result,
        time: Date.now() - start,
      });

      this.kit.onUpdate(update);

      return update;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Unable to update entity", { error });
    }
  }

  public async updateBulk(entities: Array<E>): Promise<Array<E>> {
    const result: Array<E> = [];
    for (const entity of entities) {
      result.push(await this.update(entity));
    }
    return result;
  }

  public async updateMany(
    query: QueryDslBoolQuery,
    update: DeepPartial<E>,
  ): Promise<void> {
    const start = Date.now();

    this.kit.verifyReadonly(update);

    const updateDate = this.metadata.columns.find(
      (c) => c.decorator === "UpdateDateColumn",
    );
    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");

    if (updateDate) {
      (update as any)[updateDate.key] = new Date();
    }

    try {
      const result = await this.client.updateByQuery({
        index: this.indexName,
        body: {
          script: {
            source:
              Object.keys(update)
                .map((key) => `ctx._source.${key} = params.${key}`)
                .join("; ") + (version ? `; ctx._source.${version.key} += 1` : ""),
            params: update,
          },
          query: { bool: query },
        },
      });

      await this.client.indices.refresh({ index: this.indexName });

      this.logger.debug("Repository done: updateMany", {
        input: {
          query,
          update,
        },
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to update entities", { error });
    }
  }

  // private

  private createPrimaryQuery(entity: E): QueryDslBoolQuery {
    const must: Array<QueryDslQueryContainer> = [];

    for (const key of this.metadata.primaryKeys) {
      must.push({ term: { [key]: entity[key] } });
    }

    return { must };
  }

  private createDefaultQuery(query: QueryDslBoolQuery = {}): QueryDslBoolQuery {
    const result = { ...query };
    const must_not: Array<any> = [];

    if (result.must_not) {
      must_not.push(...(isArray(query.must_not) ? query.must_not : [query.must_not]));
    }

    const deleteDate = this.metadata.columns.find(
      (c) => c.decorator === "DeleteDateColumn",
    );
    if (deleteDate) {
      must_not.push({ exists: { field: deleteDate.key } });
    }

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (expiryDate) {
      must_not.push({ range: { [expiryDate.key]: { lte: new Date().toISOString() } } });
    }

    return { ...query, must_not };
  }

  private createUpdateQuery(entity: E): QueryDslBoolQuery {
    const result: QueryDslBoolQuery = this.createPrimaryQuery(entity);

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
      if (!result.must_not) result.must_not = [];
      (result.must_not as Array<QueryDslQueryContainer>).push({
        exists: { field: deleteDate.key },
      });
    }

    const expiryDate = this.metadata.columns.find(
      (c) => c.decorator === "ExpiryDateColumn",
    );
    if (expiryDate) {
      if (!result.must_not) result.must_not = [];
      (result.must_not as Array<QueryDslQueryContainer>).push({
        range: { [expiryDate.key]: { lte: new Date().toISOString() } },
      });
    }

    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");
    if (version) {
      if (!result.must) result.must = [];
      (result.must as Array<QueryDslQueryContainer>).push({
        term: { [version.key]: entity[version.key] },
      });
    }

    return result;
  }

  private async getNextIncrement(key: string): Promise<number> {
    const start = Date.now();

    try {
      const result = await this.client.search<any>({
        index: this.incrementName,
        query: { term: { key } },
        size: 1,
      });

      if (result.hits.hits.length === 0) {
        await this.client.index({
          index: this.incrementName,
          body: { key, value: 1 },
          refresh: "wait_for",
        });

        return 1;
      }

      const [hit] = result.hits.hits;

      const value = hit._source.value + 1;

      if (!hit._id) {
        throw new ElasticRepositoryError("Failed to get increment id", {
          debug: { hit },
        });
      }

      await this.client.update({
        index: this.incrementName,
        id: hit._id,
        body: { doc: { value } },
        refresh: "wait_for",
      });

      this.logger.debug("Repository done: getNextIncrement", {
        input: { key },
        result: { value },
        time: Date.now() - start,
      });

      return value;
    } catch (error: any) {
      this.logger.error("Repository error", error);
      throw new ElasticRepositoryError("Failed to get next increment", { error });
    }
  }

  private handleHit(hit: SearchHit<any>): E {
    return this.copy(hit._source);
  }

  private async waitForElastic(
    timeout: ReadableTime = "30s",
    delay: ReadableTime = "2s",
  ): Promise<void> {
    const end = Date.now() + ms(timeout);

    while (Date.now() < end) {
      try {
        const health = await this.client.cluster.health();
        if (health.status === "yellow" || health.status === "green") {
          return;
        }
      } catch (_) {
        /* ignore */
      }

      await sleep(ms(delay));
    }

    throw new ElasticRepositoryError("Elasticsearch did not become ready in time.");
  }
}
