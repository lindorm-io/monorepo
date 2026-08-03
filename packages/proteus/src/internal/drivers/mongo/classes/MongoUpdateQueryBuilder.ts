import type { IAmphora } from "@lindorm/amphora";
import type { Condition } from "@lindorm/match";
import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { IUpdateQueryBuilder } from "../../../../interfaces/UpdateQueryBuilder.js";
import type { WriteResult } from "../../../../interfaces/InsertQueryBuilder.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { compilePredicatesToFilter } from "../utils/compile-aggregation-pipeline.js";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria.js";
import { resolveCollectionName } from "../utils/resolve-collection-name.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { serialiseArray } from "../../../entity/utils/serialise.js";
import { dehydrateTypedJson } from "../../../entity/utils/typed-json.js";

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
  private readonly amphora: IAmphora | undefined;
  private updateData: DeepPartial<E> | null = null;
  private predicates: Array<{ predicate: Condition<E>; conjunction: "and" | "or" }> = [];

  constructor(
    db: Db,
    metadata: EntityMetadata,
    session?: ClientSession,
    amphora?: IAmphora,
  ) {
    this.db = db;
    this.metadata = metadata;
    this.session = session;
    this.amphora = amphora;
  }

  set(data: DeepPartial<E>): this {
    this.updateData = data;
    return this;
  }

  where(criteria: Condition<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  andWhere(criteria: Condition<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  orWhere(criteria: Condition<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  returning(): this {
    // No-op for MongoDB — RETURNING is not supported, results are not returned
    return this;
  }

  async execute(): Promise<WriteResult<E>> {
    // Reject joined inheritance children
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB update is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.save() instead.`,
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "The query builder cannot update joined-inheritance child entities; use repository.save() instead.",
          data: { entity: this.metadata.entity.name },
        },
      );
    }

    if (!this.updateData) return { rows: [], rowCount: 0 };
    if (this.predicates.length === 0) {
      throw new ProteusRepositoryError(
        `QB update requires a WHERE clause. Call .where() before .execute().`,
        {
          code: "invalid_query",
          title: "Invalid Query",
          details:
            "A query builder update requires a WHERE clause; call .where() before .execute().",
          data: { entity: this.metadata.entity.name },
        },
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

      // A @TypedJson key owns two document keys. Setting the data key alone left
      // the previous document's sidecar in place, so the fresh data was rejoined
      // against stale type metadata and hydrated as mistyped values.
      if (field?.typedJson) {
        const { data, meta } = dehydrateTypedJson(
          field,
          value,
          this.amphora,
          this.metadata.entity.name,
        );
        setFields[mongoField] = data ?? null;
        setFields[field.typedJson.column] = meta;
        continue;
      }

      // A builder write bypasses the ORM lifecycle but not the storage contract:
      // an @Encrypted key holds ciphertext, so writing the plaintext here would
      // leak it and make the read path fail to open it. The typed-array coercion
      // is the one dehydrateEntity applies — BSON demotes a raw bigint array to a
      // lossy Long, so a builder update corrupted what insert stored right.
      const transformed = dehydrateFieldValue(value, field, this.metadata.entity.name, {
        amphora: this.amphora,
        coerce: (v) =>
          v != null && field?.type === "array" && field.arrayType
            ? serialiseArray(v, field.arrayType, field.mode)
            : v,
      });
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
