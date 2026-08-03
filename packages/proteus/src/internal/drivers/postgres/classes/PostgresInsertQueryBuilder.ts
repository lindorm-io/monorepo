import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Dict } from "@lindorm/types";
import type {
  IEntity,
  IInsertQueryBuilder,
  WriteResult,
} from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { ProteusError } from "../../../../errors/ProteusError.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { dehydrateTypedJson } from "../../../entity/utils/typed-json.js";
import { coerceWriteValue } from "../utils/query/coerce-value.js";
import { hydrateReturning } from "../utils/query/hydrate-returning.js";
import { resolveTableName } from "../utils/query/resolve-table-name.js";

export class PostgresInsertQueryBuilder<
  E extends IEntity,
> implements IInsertQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: PostgresQueryClient;
  private readonly namespace: string | null;
  private readonly amphora: IAmphora | undefined;
  private data: Array<Dict> = [];
  private returningFields: Array<string> | "*" | null = null;

  constructor(
    metadata: EntityMetadata,
    client: PostgresQueryClient,
    namespace?: string | null,
    amphora?: IAmphora,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
    this.amphora = amphora;
  }

  values(data: Array<DeepPartial<E>>): this {
    this.data = data as Array<Dict>;
    return this;
  }

  returning(...fields: Array<keyof E | "*">): this {
    if (fields.includes("*" as any)) {
      this.returningFields = "*";
    } else {
      this.returningFields = fields.map((f) => {
        const field = this.metadata.fields.find((mf) => mf.key === (f as string));
        return field?.name ?? (f as string);
      });
    }
    return this;
  }

  async execute(): Promise<WriteResult<E>> {
    if (this.data.length === 0) {
      return { rows: [], rowCount: 0 };
    }

    // Joined inheritance children require multi-table writes — not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "INSERT via QueryBuilder is not supported for joined inheritance entities — use repository.insert()",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details: `Joined-inheritance entity "${this.metadata.entity.name}" spans multiple tables and cannot be inserted via the query builder; use repository.insert() instead.`,
          data: { operation: "insert.execute", entity: this.metadata.entity.name },
        },
      );
    }

    const colKeys = Object.keys(this.data[0]);

    // Validate all rows have identical key sets
    for (let i = 1; i < this.data.length; i++) {
      const rowKeys = Object.keys(this.data[i]);
      if (
        rowKeys.length !== colKeys.length ||
        rowKeys.some((k) => !colKeys.includes(k))
      ) {
        throw new ProteusError(
          `INSERT on "${this.metadata.entity.name}": row ${i} has different keys than row 0`,
          {
            code: "invalid_query",
            title: "Invalid Query",
            details: `Batch INSERT on "${this.metadata.entity.name}" requires every row to share the same set of column keys, but row ${i} differs from row 0.`,
            data: { entity: this.metadata.entity.name, operation: "insert.execute" },
          },
        );
      }
    }

    // Inject discriminator column into the first row's keys if needed
    // (applyDiscriminatorColumn works on {column,value}[] but we need to ensure
    // the key is present in colKeys for all rows)
    const discColEntry = this.getDiscriminatorEntry();
    if (discColEntry && !colKeys.includes(discColEntry.key)) {
      colKeys.push(discColEntry.key);
      // Ensure all rows have the discriminator key
      for (const row of this.data) {
        row[discColEntry.key] = discColEntry.value;
      }
    } else if (discColEntry) {
      // Overwrite discriminator value in all rows
      for (const row of this.data) {
        row[discColEntry.key] = discColEntry.value;
      }
    }

    // A @TypedJson key contributes TWO columns: its data column and its sidecar.
    // Emitting only the data column left the type metadata unwritten, so every
    // nested Date/Buffer/BigInt came back as its JSON-safe stand-in.
    const colNames: Array<string> = [];
    for (const key of colKeys) {
      const field = this.metadata.fields.find((f) => f.key === key);
      colNames.push(field?.name ?? key);
      if (field?.typedJson) colNames.push(field.typedJson.column);
    }

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);

    const params: Array<unknown> = [];
    const rowPlaceholders: Array<string> = [];

    for (const row of this.data) {
      // Column name → value for this row, so a @TypedJson key can split once
      // and fill both of its columns.
      const values = new Map<string, unknown>();

      for (const key of colKeys) {
        const field = this.metadata.fields.find((f) => f.key === key);

        if (field?.typedJson) {
          const { data, meta } = dehydrateTypedJson(
            field,
            row[key],
            this.amphora,
            this.metadata.entity.name,
          );
          values.set(field.name, coerceWriteValue(data, field ?? null));
          values.set(field.typedJson.column, meta);
          continue;
        }

        // A builder write bypasses the ORM lifecycle but not the storage
        // contract: an @Encrypted column holds ciphertext, so writing the
        // plaintext here would leak it and make the read path fail to open it.
        values.set(
          field?.name ?? key,
          dehydrateFieldValue(row[key], field, this.metadata.entity.name, {
            amphora: this.amphora,
            coerce: (v) => coerceWriteValue(v, field ?? null),
          }),
        );
      }

      const placeholders = colNames.map((name) => {
        params.push(values.get(name));
        return `$${params.length}`;
      });
      rowPlaceholders.push(`(${placeholders.join(", ")})`);
    }

    let text = `INSERT INTO ${tableName} (${colNames.map(quoteIdentifier).join(", ")}) VALUES ${rowPlaceholders.join(", ")}`;

    if (this.returningFields === "*") {
      text += " RETURNING *";
    } else if (this.returningFields) {
      text += ` RETURNING ${this.returningFields.map(quoteIdentifier).join(", ")}`;
    }

    const result = await this.client.query(text, params);

    const rows = this.returningFields
      ? result.rows.map((row: any) =>
          hydrateReturning<E>(row, this.metadata, {
            hooks: false,
            amphora: this.amphora,
          }),
        )
      : [];

    return { rows, rowCount: result.rowCount ?? this.data.length };
  }

  private getDiscriminatorEntry(): { key: string; value: unknown } | null {
    if (!this.metadata.inheritance) return null;
    if (this.metadata.inheritance.discriminatorValue == null) return null;

    const field = this.metadata.fields.find(
      (f) => f.key === this.metadata.inheritance!.discriminatorField,
    );
    if (!field) return null;

    return {
      key: field.key,
      value: this.metadata.inheritance.discriminatorValue,
    };
  }
}
