import type { IAmphora } from "@lindorm/amphora";
import type { ClientSession, Db, Document } from "mongodb";
import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type {
  IInsertQueryBuilder,
  WriteResult,
} from "../../../../interfaces/InsertQueryBuilder.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { MongoDuplicateKeyError } from "../errors/MongoDuplicateKeyError.js";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../entity/utils/resolve-polymorphic-metadata.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { serialiseArray } from "../../../entity/utils/serialise.js";
import {
  dehydrateTypedJson,
  typedJsonMetaDictKey,
} from "../../../entity/utils/typed-json.js";
import { applyAutoIncrement } from "../utils/apply-auto-increment.js";
import { resolveCollectionName } from "../utils/resolve-collection-name.js";

const DUPLICATE_KEY_CODE = 11000;

/**
 * MongoDB INSERT query builder.
 *
 * Compiles to insertMany. Bypasses hooks, cascades, and validation.
 * Injects discriminator for single-table inheritance children.
 * Throws for joined inheritance children.
 */
export class MongoInsertQueryBuilder<
  E extends IEntity,
> implements IInsertQueryBuilder<E> {
  private readonly db: Db;
  private readonly metadata: EntityMetadata;
  private readonly session: ClientSession | undefined;
  private readonly amphora: IAmphora | undefined;
  private data: Array<DeepPartial<E>> = [];

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

  values(data: Array<DeepPartial<E>>): this {
    this.data = data;
    return this;
  }

  returning(): this {
    // No-op for MongoDB — all fields are always returned after insert
    return this;
  }

  async execute(): Promise<WriteResult<E>> {
    // Reject joined inheritance children
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB insert is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.insert() instead.`,
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "The query builder cannot insert joined-inheritance child entities; use repository.insert() instead.",
          data: { entity: this.metadata.entity.name },
        },
      );
    }

    if (this.data.length === 0) return { rows: [], rowCount: 0 };

    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);
    const sessionOpts = this.session ? { session: this.session } : undefined;

    // Build documents from partial entity data
    const docs: Array<Document> = [];
    const rows: Array<Record<string, unknown>> = [];

    for (const item of this.data) {
      const row: Record<string, unknown> = {};

      for (const field of this.metadata.fields) {
        if (!(field.key in (item as any))) continue;

        // A builder write bypasses the ORM lifecycle but not the storage
        // contract: dehydrateEntity splits @TypedJson into both columns,
        // serialises a typed array so BSON does not demote bigint to a lossy
        // Long, and seals @Encrypted. Writing the authored value instead left
        // the sidecar unwritten and the ciphertext column in the clear.
        if (field.typedJson) {
          const { data, meta } = dehydrateTypedJson(
            field,
            (item as any)[field.key],
            this.amphora,
            this.metadata.entity.name,
          );
          row[field.key] = data;
          row[typedJsonMetaDictKey(field.key)] = meta;
          continue;
        }

        row[field.key] = dehydrateFieldValue(
          (item as any)[field.key],
          field,
          this.metadata.entity.name,
          {
            amphora: this.amphora,
            coerce: (v) =>
              v != null && field.type === "array" && field.arrayType
                ? serialiseArray(v, field.arrayType, field.mode)
                : v,
          },
        );
      }

      // Inject discriminator for single-table children
      if (
        this.metadata.inheritance?.strategy === "single-table" &&
        this.metadata.inheritance.discriminatorValue != null
      ) {
        row[this.metadata.inheritance.discriminatorField] =
          this.metadata.inheritance.discriminatorValue;
      }

      rows.push(row);

      // Build the MongoDB document using field name mapping
      const doc: Document = {};
      const pkValues: Record<string, unknown> = {};

      for (const field of this.metadata.fields) {
        if (!(field.key in row)) continue;

        if (this.metadata.primaryKeys.includes(field.key)) {
          pkValues[field.key] = row[field.key];
        } else {
          doc[field.name] = row[field.key];
        }

        // A @TypedJson key owns two document keys; emitting only the data one
        // left the type metadata unwritten and every nested Date/Buffer/BigInt
        // came back as its JSON-safe stand-in.
        if (field.typedJson) {
          doc[field.typedJson.column] = row[typedJsonMetaDictKey(field.key)];
        }
      }

      // Build _id
      if (this.metadata.primaryKeys.length === 1) {
        doc._id = pkValues[this.metadata.primaryKeys[0]];
      } else {
        const sorted = [...this.metadata.primaryKeys].sort();
        const compound: Record<string, unknown> = {};
        for (const key of sorted) {
          compound[key] = pkValues[key];
        }
        doc._id = compound;
      }

      // A builder insert has no ORM lifecycle, but a @Generated("increment")
      // PK is minted by the DRIVER, not the lifecycle. Skipping it sent `_id`
      // to Mongo unset, Mongo minted an ObjectId in its place, and the read
      // back blew up converting that object to the column's declared bigint.
      await applyAutoIncrement(doc, this.metadata, this.db, this.session);

      // Mirror the minted values back into the row the result is hydrated from,
      // so the returned entity carries the id Mongo actually stored.
      for (const gen of this.metadata.generated) {
        if (!(gen.key in row)) {
          const field = this.metadata.fields.find((f) => f.key === gen.key);
          row[gen.key] = this.metadata.primaryKeys.includes(gen.key)
            ? doc._id
            : doc[field?.name ?? gen.key];
        }
      }

      docs.push(doc);
    }

    try {
      await collection.insertMany(docs, {
        ordered: true,
        ...sessionOpts,
      });
    } catch (error: any) {
      if (error?.code === DUPLICATE_KEY_CODE) {
        throw new MongoDuplicateKeyError(
          `Duplicate primary key during QB insert for "${this.metadata.entity.name}"`,
          {
            code: "unique_violation",
            title: "Unique Violation",
            details:
              "A document with the same primary key already exists in the collection.",
            debug: { entityName: this.metadata.entity.name },
          },
        );
      }
      throw error;
    }

    // Hydrate results from the row dicts
    const results: Array<E> = rows.map((row) => {
      const effectiveMetadata = resolvePolymorphicMetadata(row, this.metadata);
      return defaultHydrateEntity<E>(structuredClone(row), effectiveMetadata, {
        snapshot: false,
        hooks: false,
        amphora: this.amphora,
      });
    });

    return { rows: results, rowCount: results.length };
  }
}
