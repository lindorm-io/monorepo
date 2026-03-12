import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type { IUpdateQueryBuilder } from "../../../../interfaces/UpdateQueryBuilder";
import type { WriteResult } from "../../../../interfaces/InsertQueryBuilder";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { compilePredicatesToFilter } from "../utils/compile-aggregation-pipeline";
import { flattenEmbeddedCriteria } from "#internal/utils/query/flatten-embedded-criteria";
import { resolveCollectionName } from "../utils/resolve-collection-name";

/**
 * MongoDB UPDATE query builder.
 *
 * Compiles to updateMany with $set. Bypasses hooks, cascades, and version checks.
 * Injects discriminator filter for single-table inheritance children.
 * Throws for joined inheritance children.
 */
export class MongoUpdateQueryBuilder<
  E extends IEntity,
> implements IUpdateQueryBuilder<E> {
  private readonly db: Db;
  private readonly metadata: EntityMetadata;
  private readonly session: ClientSession | undefined;
  private updateData: DeepPartial<E> | null = null;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(db: Db, metadata: EntityMetadata, session?: ClientSession) {
    this.db = db;
    this.metadata = metadata;
    this.session = session;
  }

  public set(data: DeepPartial<E>): this {
    this.updateData = data;
    return this;
  }

  public where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public returning(): this {
    // No-op for MongoDB — RETURNING is not supported, results are not returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // Reject joined inheritance children
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB update is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.save() instead.`,
      );
    }

    if (!this.updateData) return { rows: [], rowCount: 0 };
    if (this.predicates.length === 0) {
      throw new ProteusRepositoryError(
        `QB update requires a WHERE clause. Call .where() before .execute().`,
      );
    }

    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);
    const sessionOpts = this.session ? { session: this.session } : undefined;

    // Build filter from predicates
    const filter = this.buildFilter();

    // Build $set fields
    const setFields: Record<string, unknown> = {};
    for (const [fieldKey, value] of Object.entries(
      this.updateData as Record<string, unknown>,
    )) {
      const field = this.metadata.fields.find((f) => f.key === fieldKey);
      if (this.metadata.primaryKeys.includes(fieldKey)) continue; // Can't update PKs

      const mongoField = field?.name ?? fieldKey;
      const transformed =
        value != null && field?.transform ? field.transform.to(value) : value;
      setFields[mongoField] = transformed ?? null;
    }

    if (Object.keys(setFields).length === 0) return { rows: [], rowCount: 0 };

    const result = await collection.updateMany(filter, { $set: setFields }, sessionOpts);

    return { rows: [], rowCount: result.modifiedCount };
  }

  // QB write operations intentionally bypass soft-delete system filters,
  // consistent with other drivers.
  private buildFilter(): Filter<Document> {
    const conditions: Array<Document> = [];

    // User predicates — respect conjunction (and/or)
    if (this.predicates.length > 0) {
      const userFilter = compilePredicatesToFilter(
        this.predicates.map((p) => ({
          ...p,
          predicate: flattenEmbeddedCriteria(p.predicate, this.metadata),
        })),
        this.metadata,
      );
      if (Object.keys(userFilter).length > 0) {
        conditions.push(userFilter);
      }
    }

    // Discriminator filter for single-table inheritance
    if (this.metadata.inheritance?.discriminatorValue != null) {
      const discField = this.metadata.inheritance.discriminatorField;
      const discValue = this.metadata.inheritance.discriminatorValue;
      const field = this.metadata.fields.find((f) => f.key === discField);
      const mongoField = field?.name ?? discField;
      conditions.push({ [mongoField]: discValue });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
  }
}
