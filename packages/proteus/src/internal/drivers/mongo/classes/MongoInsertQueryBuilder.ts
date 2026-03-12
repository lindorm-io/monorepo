import type { ClientSession, Db, Document } from "mongodb";
import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type {
  IInsertQueryBuilder,
  WriteResult,
} from "../../../../interfaces/InsertQueryBuilder";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { MongoDuplicateKeyError } from "../errors/MongoDuplicateKeyError";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import { resolvePolymorphicMetadata } from "#internal/entity/utils/resolve-polymorphic-metadata";
import { resolveCollectionName } from "../utils/resolve-collection-name";

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
  private data: Array<DeepPartial<E>> = [];

  public constructor(db: Db, metadata: EntityMetadata, session?: ClientSession) {
    this.db = db;
    this.metadata = metadata;
    this.session = session;
  }

  public values(data: Array<DeepPartial<E>>): this {
    this.data = data;
    return this;
  }

  public returning(): this {
    // No-op for MongoDB — all fields are always returned after insert
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // Reject joined inheritance children
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB insert is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.insert() instead.`,
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
        if (field.key in (item as any)) {
          let value = (item as any)[field.key];
          if (value != null && field.transform) {
            value = field.transform.to(value);
          }
          row[field.key] = value;
        }
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
          { debug: { entityName: this.metadata.entity.name } },
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
      });
    });

    return { rows: results, rowCount: results.length };
  }
}
