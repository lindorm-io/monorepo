import type { IAmphora } from "@lindorm/amphora";
import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type { DeleteOptions, FindOptions } from "../../../../types";
import type { EntityMetadata, QueryScope } from "../../../entity/types/metadata";
import type { FilterRegistry } from "../../../utils/query/filter-registry";
import { dehydrateEntity } from "../utils/dehydrate";
import { hydrateEntity, hydrateEntities } from "../utils/hydrate";
import { compileFilter, compileFilterWithSystem } from "../utils/compile-filter";
import { compileSort, compileNullSafeSort } from "../utils/compile-sort";
import { compileProjection } from "../utils/compile-projection";
import { writeVersionSnapshot } from "../utils/write-version-snapshot";
import { buildIdFilter } from "../utils/build-compound-id";
import { MongoDriverError } from "../errors/MongoDriverError";
import { MongoDuplicateKeyError } from "../errors/MongoDuplicateKeyError";
import { MongoOptimisticLockError } from "../errors/MongoOptimisticLockError";
import { buildPrimaryKeyDebug } from "../../../utils/repository/build-pk-debug";
import { guardEmptyCriteria } from "../../../utils/repository/guard-empty-criteria";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria";
import { resolveCollectionName } from "../utils/resolve-collection-name";

const DUPLICATE_KEY_CODE = 11000;

/**
 * Get the session options object for MongoDB operations.
 * Returns undefined when no session is available.
 */
const sessionOpts = (session?: ClientSession): { session: ClientSession } | undefined => {
  return session ? { session } : undefined;
};

export class MongoExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly metadata: EntityMetadata;
  private readonly db: Db;
  private readonly filterRegistry: FilterRegistry;
  private readonly session: ClientSession | undefined;
  private readonly collectionName: string;
  private readonly deleteFieldKey: string | null;
  private readonly expiryFieldKey: string | null;
  private readonly versionFieldKey: string | null;
  private readonly versionEndFieldKey: string | null;
  private readonly versionStartFieldKey: string | null;
  private readonly updateDateFieldName: string | null;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    metadata: EntityMetadata,
    db: Db,
    _namespace: string | null,
    filterRegistry?: FilterRegistry,
    session?: ClientSession,
    amphora?: IAmphora,
  ) {
    this.metadata = metadata;
    this.db = db;
    this.filterRegistry = filterRegistry ?? new Map();
    this.session = session;
    this.amphora = amphora;
    this.collectionName = resolveCollectionName(metadata);
    this.deleteFieldKey =
      metadata.fields.find((f) => f.decorator === "DeleteDate")?.key ?? null;
    this.expiryFieldKey =
      metadata.fields.find((f) => f.decorator === "ExpiryDate")?.key ?? null;
    this.versionFieldKey =
      metadata.fields.find((f) => f.decorator === "Version")?.key ?? null;
    this.versionEndFieldKey =
      metadata.fields.find((f) => f.decorator === "VersionEndDate")?.key ?? null;
    this.versionStartFieldKey =
      metadata.fields.find((f) => f.decorator === "VersionStartDate")?.key ?? null;
    this.updateDateFieldName =
      metadata.fields.find((f) => f.decorator === "UpdateDate")?.name ?? null;
  }

  // ─── Insert ───────────────────────────────────────────────────────────

  public async executeInsert(entity: E): Promise<E> {
    const collection = this.db.collection(this.collectionName);
    const doc = dehydrateEntity(entity, this.metadata, this.amphora);

    // Auto-increment handling
    await this.applyAutoIncrement(doc);

    try {
      await collection.insertOne(doc, sessionOpts(this.session));
    } catch (error: any) {
      if (error?.code === DUPLICATE_KEY_CODE) {
        throw new MongoDuplicateKeyError(
          `Duplicate primary key for "${this.metadata.entity.name}"`,
          { debug: { entityName: this.metadata.entity.name, _id: doc._id } },
        );
      }
      throw error;
    }

    // Write version snapshot if entity has @Version
    if (this.versionFieldKey) {
      const version = (entity as any)[this.versionFieldKey] as number;
      await writeVersionSnapshot(
        this.db,
        this.collectionName,
        doc,
        version,
        this.session,
        this.extractUpdateDate(doc),
      );
    }

    return this.hydrateFromDoc(doc);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  public async executeUpdate(entity: E): Promise<E> {
    const collection = this.db.collection(this.collectionName);
    const doc = dehydrateEntity(entity, this.metadata, this.amphora);

    // Build filter with PK + optimistic lock
    const pkValues: Record<string, unknown> = {};
    for (const pk of this.metadata.primaryKeys) {
      pkValues[pk] = (entity as any)[pk];
    }
    const filter: Filter<Document> = buildIdFilter(this.metadata.primaryKeys, pkValues);

    if (this.versionFieldKey) {
      const currentVersion = (entity as any)[this.versionFieldKey] as number;
      const field = this.metadata.fields.find((f) => f.key === this.versionFieldKey);
      const mongoVersionField = field?.name ?? this.versionFieldKey;
      // Entity version has already been incremented by EntityManager,
      // so we check for (currentVersion - 1) in the DB
      (filter as any)[mongoVersionField] = currentVersion - 1;
    }

    // Extract _id from doc before using $set (can't $set _id)
    const { _id, ...setFields } = doc;

    let result;
    try {
      result = await collection.updateOne(
        filter,
        { $set: setFields },
        sessionOpts(this.session),
      );
    } catch (error: any) {
      if (error?.code === DUPLICATE_KEY_CODE) {
        throw new MongoDuplicateKeyError(
          `Unique constraint violation during update for "${this.metadata.entity.name}"`,
          { debug: { entityName: this.metadata.entity.name } },
        );
      }
      throw error;
    }

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      if (this.versionFieldKey) {
        throw new MongoOptimisticLockError(
          this.metadata.entity.name,
          buildPrimaryKeyDebug(entity as any, this.metadata.primaryKeys),
        );
      }
      throw new MongoDriverError(
        `Update failed: no matching document found for "${this.metadata.entity.name}"`,
        { debug: buildPrimaryKeyDebug(entity as any, this.metadata.primaryKeys) },
      );
    }

    // Write version snapshot
    if (this.versionFieldKey) {
      const version = (entity as any)[this.versionFieldKey] as number;
      await writeVersionSnapshot(
        this.db,
        this.collectionName,
        doc,
        version,
        this.session,
        this.extractUpdateDate(doc),
      );
    }

    return this.hydrateFromDoc(doc);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", MongoDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry, {
      withDeleted: true,
    });

    if (options?.limit) {
      // MongoDB deleteMany doesn't support limit, so find IDs first then delete
      const docs = await collection
        .find(filter, { projection: { _id: 1 }, ...sessionOpts(this.session) })
        .limit(options.limit)
        .toArray();

      if (docs.length === 0) return;

      const ids = docs.map((d) => d._id);
      await collection.deleteMany({ _id: { $in: ids } }, sessionOpts(this.session));
    } else {
      await collection.deleteMany(filter, sessionOpts(this.session));
    }
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    if (!this.deleteFieldKey) {
      throw new MongoDriverError(
        "Entity does not support soft delete (missing @DeleteDate field)",
      );
    }

    guardEmptyCriteria(criteria, "soft delete", MongoDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry, {
      withDeleted: true,
    });

    const deleteField = this.metadata.fields.find((f) => f.key === this.deleteFieldKey);
    const mongoDeleteField = deleteField?.name ?? this.deleteFieldKey;

    await collection.updateMany(
      filter,
      { $set: { [mongoDeleteField]: new Date() } },
      sessionOpts(this.session),
    );
  }

  // ─── Restore ──────────────────────────────────────────────────────────

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    if (!this.deleteFieldKey) {
      throw new MongoDriverError(
        "Entity does not support soft delete (missing @DeleteDate field)",
      );
    }

    guardEmptyCriteria(criteria, "restore", MongoDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry, {
      withDeleted: true,
    });

    const deleteField = this.metadata.fields.find((f) => f.key === this.deleteFieldKey);
    const mongoDeleteField = deleteField?.name ?? this.deleteFieldKey;

    await collection.updateMany(
      filter,
      { $set: { [mongoDeleteField]: null } },
      sessionOpts(this.session),
    );
  }

  // ─── Delete Expired ───────────────────────────────────────────────────

  public async executeDeleteExpired(): Promise<void> {
    if (!this.expiryFieldKey) return;

    const collection = this.db.collection(this.collectionName);
    const expiryField = this.metadata.fields.find((f) => f.key === this.expiryFieldKey);
    const mongoExpiryField = expiryField?.name ?? this.expiryFieldKey;

    // Actively delete documents whose expiry date has passed.
    // This supplements MongoDB's TTL index (which runs every ~60 seconds)
    // and ensures immediate removal in tests and on-demand cleanup.
    await collection.deleteMany(
      {
        [mongoExpiryField]: { $ne: null, $lte: new Date() },
      },
      sessionOpts(this.session),
    );
  }

  // ─── TTL ──────────────────────────────────────────────────────────────

  public async executeTtl(criteria: Predicate<E>): Promise<number | null> {
    if (!this.expiryFieldKey) return null;

    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilter(criteria, this.metadata);
    const doc = await collection.findOne(filter, sessionOpts(this.session));

    if (!doc) {
      throw new MongoDriverError(
        `TTL failed: document not found for "${this.metadata.entity.name}"`,
      );
    }

    const expiryField = this.metadata.fields.find((f) => f.key === this.expiryFieldKey);
    const mongoExpiryField = expiryField?.name ?? this.expiryFieldKey;
    const expiresAt = doc[mongoExpiryField];

    if (expiresAt == null) return null;

    const expiryDate =
      expiresAt instanceof Date ? expiresAt : new Date(expiresAt as string);
    const remaining = expiryDate.getTime() - Date.now();

    return remaining > 0 ? remaining : 0;
  }

  // ─── Find ─────────────────────────────────────────────────────────────

  public async executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    _operationScope?: QueryScope,
  ): Promise<Array<E>> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    let filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry, {
      withDeleted: options.withDeleted,
      withoutScope: options.withoutScope,
      filters: options.filters,
    });

    // Apply version filtering for version-keyed entities
    filter = this.applyVersionFilter(filter, options);

    const effectiveOrder =
      (options.order as Record<string, "ASC" | "DESC"> | undefined) ??
      (this.metadata.defaultOrder as Record<string, "ASC" | "DESC"> | undefined);

    // Try null-safe aggregation sort first (handles NULLS LAST/FIRST)
    const nullSafeStages = compileNullSafeSort(effectiveOrder, this.metadata);

    if (nullSafeStages) {
      // Use aggregation pipeline for null-safe sorting
      const pipeline: Array<Document> = [{ $match: filter }, ...nullSafeStages];

      const projection = compileProjection(
        options.select as Array<string> | undefined,
        this.metadata,
      );
      if (projection) pipeline.push({ $project: projection });
      if (options.offset) pipeline.push({ $skip: options.offset });
      if (options.limit) pipeline.push({ $limit: options.limit });

      const docs = await collection
        .aggregate(pipeline, sessionOpts(this.session))
        .toArray();
      return hydrateEntities<E>(docs, this.metadata, this.amphora);
    }

    const sort = compileSort(effectiveOrder, this.metadata);
    const projection = compileProjection(
      options.select as Array<string> | undefined,
      this.metadata,
    );

    let cursor = collection.find(filter, sessionOpts(this.session));

    if (sort) cursor = cursor.sort(sort);
    if (projection) cursor = cursor.project(projection);
    if (options.offset) cursor = cursor.skip(options.offset);
    if (options.limit) cursor = cursor.limit(options.limit);

    const docs = await cursor.toArray();
    return hydrateEntities<E>(docs, this.metadata, this.amphora);
  }

  // ─── Count ────────────────────────────────────────────────────────────

  public async executeCount(
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    let filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry, {
      withDeleted: options.withDeleted,
      withoutScope: options.withoutScope,
      filters: options.filters,
    });

    // Apply version filtering for version-keyed entities
    filter = this.applyVersionFilter(filter, options);

    return collection.countDocuments(filter, sessionOpts(this.session));
  }

  // ─── Exists ───────────────────────────────────────────────────────────

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    let filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry);

    // Apply version filtering: only check current versions
    filter = this.applyVersionFilter(filter, {} as FindOptions<E>);

    const count = await collection.countDocuments(filter, {
      limit: 1,
      ...sessionOpts(this.session),
    });

    return count > 0;
  }

  // ─── Increment ────────────────────────────────────────────────────────

  public async executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry);

    const field = this.metadata.fields.find((f) => f.key === (property as string));
    const mongoField = field?.name ?? (property as string);

    await collection.updateMany(
      filter,
      { $inc: { [mongoField]: value } },
      sessionOpts(this.session),
    );
  }

  // ─── Decrement ────────────────────────────────────────────────────────

  public async executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const collection = this.db.collection(this.collectionName);
    const filter = compileFilterWithSystem(criteria, this.metadata, this.filterRegistry);

    const field = this.metadata.fields.find((f) => f.key === (property as string));
    const mongoField = field?.name ?? (property as string);

    await collection.updateMany(
      filter,
      { $inc: { [mongoField]: -value } },
      sessionOpts(this.session),
    );
  }

  // ─── Insert Bulk ──────────────────────────────────────────────────────

  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    const collection = this.db.collection(this.collectionName);
    const docs: Array<Document> = [];

    for (const entity of entities) {
      const doc = dehydrateEntity(entity, this.metadata, this.amphora);
      await this.applyAutoIncrement(doc);
      docs.push(doc);
    }

    try {
      await collection.insertMany(docs, {
        ordered: true,
        ...sessionOpts(this.session),
      });
    } catch (error: any) {
      if (error?.code === DUPLICATE_KEY_CODE) {
        throw new MongoDuplicateKeyError(
          `Duplicate primary key during bulk insert for "${this.metadata.entity.name}"`,
          { debug: { entityName: this.metadata.entity.name } },
        );
      }
      throw error;
    }

    // Write version snapshots for all inserted entities (batched insertMany)
    if (this.versionFieldKey) {
      const shadowCollectionName = `${this.collectionName}_versions`;
      const shadowCollection = this.db.collection(shadowCollectionName);
      const snapshotDocs: Array<Document> = [];

      for (let i = 0; i < entities.length; i++) {
        const version = (entities[i] as any)[this.versionFieldKey] as number;
        const { _id, ...rest } = docs[i];
        snapshotDocs.push({
          __entityId: _id,
          ...rest,
          __version: version,
          __versionedAt: this.extractUpdateDate(docs[i]) ?? new Date(),
        });
      }

      if (snapshotDocs.length > 0) {
        await shadowCollection.insertMany(snapshotDocs, {
          ordered: true,
          ...sessionOpts(this.session),
        });
      }
    }

    return docs.map((doc) => this.hydrateFromDoc(doc));
  }

  // ─── Update Many ──────────────────────────────────────────────────────

  public async executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
    options?: { systemFilters?: boolean },
  ): Promise<number> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const useSystemFilters = options?.systemFilters !== false;

    const collection = this.db.collection(this.collectionName);
    const filter = useSystemFilters
      ? compileFilterWithSystem(criteria, this.metadata, this.filterRegistry)
      : compileFilter(criteria, this.metadata);

    const setFields: Record<string, unknown> = {};

    for (const [fieldKey, value] of Object.entries(update as Record<string, unknown>)) {
      const field = this.metadata.fields.find((f) => f.key === fieldKey);
      if (this.metadata.primaryKeys.includes(fieldKey)) continue; // Can't update PKs

      const mongoField = field?.name ?? fieldKey;
      const transformed =
        value != null && field?.transform ? field.transform.to(value) : value;
      setFields[mongoField] = transformed ?? null;
    }

    if (Object.keys(setFields).length === 0) return 0;

    const result = await collection.updateMany(
      filter,
      { $set: setFields },
      sessionOpts(this.session),
    );

    return result.modifiedCount;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private hydrateFromDoc(doc: Document): E {
    return hydrateEntity<E>(doc, this.metadata, this.amphora);
  }

  private extractUpdateDate(doc: Document): Date | undefined {
    if (!this.updateDateFieldName) return undefined;
    const val = doc[this.updateDateFieldName];
    return val instanceof Date ? val : undefined;
  }

  /**
   * Add version-end filter to the given MongoDB filter for version-keyed entities.
   *
   * - Default: only return current versions (versionEnd IS NULL)
   * - withAllVersions: return all versions (no filter)
   * - versionTimestamp: return versions active at the given point in time
   *
   * Returns the filter unchanged if the entity has no VersionEndDate field.
   */
  private applyVersionFilter(
    filter: Filter<Document>,
    options: FindOptions<E>,
  ): Filter<Document> {
    if (!this.versionEndFieldKey || !this.versionStartFieldKey) return filter;

    const endField = this.metadata.fields.find((f) => f.key === this.versionEndFieldKey);
    const mongoEndField = endField?.name ?? this.versionEndFieldKey;

    if (options.withAllVersions) return filter;

    if (options.versionTimestamp) {
      const startField = this.metadata.fields.find(
        (f) => f.key === this.versionStartFieldKey,
      );
      const mongoStartField = startField?.name ?? this.versionStartFieldKey;
      const ts = options.versionTimestamp;

      // Point-in-time: half-open interval [start, end)
      const versionConditions: Array<Filter<Document>> = [
        { [mongoStartField]: { $lte: ts } },
        { $or: [{ [mongoEndField]: null }, { [mongoEndField]: { $gt: ts } }] },
      ];

      const existingConditions = Object.keys(filter).length > 0 ? [filter] : [];
      return { $and: [...existingConditions, ...versionConditions] };
    }

    // Default: current version only (versionEnd IS NULL)
    const versionCondition: Filter<Document> = { [mongoEndField]: null };
    const existingConditions = Object.keys(filter).length > 0 ? [filter] : [];
    if (existingConditions.length === 0) return versionCondition;
    return { $and: [...existingConditions, versionCondition] };
  }

  /**
   * Apply auto-increment values using the _proteus_sequences collection.
   * Uses findOneAndUpdate with $inc for atomic counter increment.
   */
  private async applyAutoIncrement(doc: Document): Promise<void> {
    for (const gen of this.metadata.generated) {
      if (gen.strategy !== "increment" && gen.strategy !== "identity") continue;

      // Check if value is already set (non-null and non-zero)
      const field = this.metadata.fields.find((f) => f.key === gen.key);
      const isPk = this.metadata.primaryKeys.includes(gen.key);
      const currentValue = isPk ? doc._id : doc[field?.name ?? gen.key];

      if (currentValue != null && currentValue !== 0) continue;

      const seqCollection = this.db.collection("_proteus_sequences");
      const seqId = `${this.metadata.entity.name}.${gen.key}`;

      const result = await seqCollection.findOneAndUpdate(
        { _id: seqId as any },
        { $inc: { seq: 1 } },
        {
          upsert: true,
          returnDocument: "after",
          ...sessionOpts(this.session),
        },
      );

      const nextVal = (result as any)?.seq ?? 1;

      if (isPk) {
        doc._id = nextVal;
      } else {
        doc[field?.name ?? gen.key] = nextVal;
      }
    }
  }
}
