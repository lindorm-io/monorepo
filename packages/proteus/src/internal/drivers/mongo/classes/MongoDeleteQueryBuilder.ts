import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type { IDeleteQueryBuilder } from "../../../../interfaces/DeleteQueryBuilder";
import type { WriteResult } from "../../../../interfaces/InsertQueryBuilder";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { compilePredicatesToFilter } from "../utils/compile-aggregation-pipeline";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria";
import { resolveCollectionName } from "../utils/resolve-collection-name";

/**
 * MongoDB DELETE / soft-DELETE query builder.
 *
 * Hard delete: compiles to deleteMany.
 * Soft delete: compiles to updateMany with $set on the delete date field.
 * Bypasses hooks, cascades, and subscriber events.
 * Injects discriminator filter for single-table inheritance children.
 * Throws for joined inheritance children.
 */
export class MongoDeleteQueryBuilder<
  E extends IEntity,
> implements IDeleteQueryBuilder<E> {
  private readonly db: Db;
  private readonly metadata: EntityMetadata;
  private readonly soft: boolean;
  private readonly session: ClientSession | undefined;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(
    db: Db,
    metadata: EntityMetadata,
    soft: boolean,
    session?: ClientSession,
  ) {
    this.db = db;
    this.metadata = metadata;
    this.soft = soft;
    this.session = session;
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
    // No-op for MongoDB — RETURNING is not supported
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // Reject joined inheritance children
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB delete is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.destroy() instead.`,
      );
    }

    if (this.predicates.length === 0) {
      throw new ProteusRepositoryError(
        `QB delete requires a WHERE clause. Call .where() before .execute().`,
      );
    }

    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);
    const sessionOpts = this.session ? { session: this.session } : undefined;
    const filter = this.buildFilter();

    if (this.soft) {
      const deleteField = this.metadata.fields.find((f) => f.decorator === "DeleteDate");
      if (!deleteField) {
        throw new NotSupportedError(
          "Entity does not support soft delete (missing @DeleteDate field)",
        );
      }

      const mongoDeleteField = deleteField.name ?? deleteField.key;

      const result = await collection.updateMany(
        filter,
        { $set: { [mongoDeleteField]: new Date() } },
        sessionOpts,
      );

      return { rows: [], rowCount: result.modifiedCount };
    }

    const result = await collection.deleteMany(filter, sessionOpts);
    return { rows: [], rowCount: result.deletedCount };
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
