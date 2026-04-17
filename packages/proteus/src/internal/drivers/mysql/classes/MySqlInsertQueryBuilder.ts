import type { DeepPartial, Dict } from "@lindorm/types";
import type { IEntity, IInsertQueryBuilder, WriteResult } from "../../../../interfaces";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { ProteusError } from "../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type { MysqlQueryClient } from "../types/mysql-query-client";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier";
import { coerceWriteValue } from "../utils/query/coerce-value";
import { resolveTableName } from "../utils/query/resolve-table-name";

/**
 * MySQL INSERT query builder.
 *
 * MySQL has no RETURNING clause. The `returning()` method is accepted for API
 * compatibility but performs a SELECT-back after INSERT to retrieve the rows.
 */
export class MySqlInsertQueryBuilder<
  E extends IEntity,
> implements IInsertQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: MysqlQueryClient;
  private readonly namespace: string | null;
  private data: Array<Dict> = [];

  public constructor(
    metadata: EntityMetadata,
    client: MysqlQueryClient,
    namespace?: string | null,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
  }

  public values(data: Array<DeepPartial<E>>): this {
    this.data = data as Array<Dict>;
    return this;
  }

  public returning(..._fields: Array<keyof E | "*">): this {
    throw new ProteusRepositoryError(
      "MySQL does not support RETURNING clauses. Use save()/insert()/update() repository methods instead, which automatically SELECT-back after write.",
    );
  }

  public async execute(): Promise<WriteResult<E>> {
    if (this.data.length === 0) {
      return { rows: [], rowCount: 0 };
    }

    // Joined inheritance children require multi-table writes -- not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "INSERT via QueryBuilder is not supported for joined inheritance entities — use repository.insert()",
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
        );
      }
    }

    // Inject discriminator column into all rows for single-table children
    const discColEntry = this.getDiscriminatorEntry();
    if (discColEntry && !colKeys.includes(discColEntry.key)) {
      colKeys.push(discColEntry.key);
      for (const row of this.data) {
        row[discColEntry.key] = discColEntry.value;
      }
    } else if (discColEntry) {
      for (const row of this.data) {
        row[discColEntry.key] = discColEntry.value;
      }
    }

    const colNames = colKeys.map((key) => {
      const field = this.metadata.fields.find((f) => f.key === key);
      return field?.name ?? key;
    });

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);

    const params: Array<unknown> = [];
    const rowPlaceholders: Array<string> = [];

    for (const row of this.data) {
      const placeholders = colKeys.map((key) => {
        const field = this.metadata.fields.find((f) => f.key === key);
        let value = row[key];
        if (field?.transform) {
          value = field.transform.to(value);
        }
        params.push(coerceWriteValue(value, field?.type ?? null));
        return "?";
      });
      rowPlaceholders.push(`(${placeholders.join(", ")})`);
    }

    const text = `INSERT INTO ${tableName} (${colNames.map(quoteIdentifier).join(", ")}) VALUES ${rowPlaceholders.join(", ")}`;

    const result = await this.client.query(text, params);

    return { rows: [], rowCount: result.rowCount };
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
