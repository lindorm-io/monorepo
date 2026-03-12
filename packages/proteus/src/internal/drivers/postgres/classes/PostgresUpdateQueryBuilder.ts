import type { DeepPartial, Dict, Predicate } from "@lindorm/types";
import type { IEntity, IUpdateQueryBuilder, WriteResult } from "../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry } from "#internal/types/query";
import { ProteusError } from "../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier";
import { coerceWriteValue } from "../utils/query/coerce-value";
import { compileWhere } from "../utils/query/compile-where";
import { hydrateReturning } from "../utils/query/hydrate-returning";
import {
  buildDiscriminatorPredicate,
  resolveTableName,
} from "../utils/query/resolve-table-name";

export class PostgresUpdateQueryBuilder<
  E extends IEntity,
> implements IUpdateQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: PostgresQueryClient;
  private readonly namespace: string | null;
  private data: Dict | null = null;
  private predicates: Array<PredicateEntry<E>> = [];
  private returningFields: Array<string> | "*" | null = null;

  public constructor(
    metadata: EntityMetadata,
    client: PostgresQueryClient,
    namespace?: string | null,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
  }

  public set(data: DeepPartial<E>): this {
    this.data = data as Dict;
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

  public returning(...fields: Array<keyof E | "*">): this {
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

  public async execute(): Promise<WriteResult<E>> {
    if (!this.data || Object.keys(this.data).length === 0) {
      return { rows: [], rowCount: 0 };
    }

    if (this.predicates.length === 0) {
      throw new ProteusError(
        `UPDATE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
      );
    }

    // Joined inheritance children require multi-table writes — not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "UPDATE via QueryBuilder is not supported for joined inheritance entities",
      );
    }

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);
    const params: Array<unknown> = [];
    const setClauses: Array<string> = [];

    for (const [key, value] of Object.entries(this.data)) {
      const field = this.metadata.fields.find((f) => f.key === key);
      const colName = field?.name ?? key;
      let transformed = value;
      if (field?.transform) {
        transformed = field.transform.to(transformed);
      }
      params.push(coerceWriteValue(transformed));
      setClauses.push(`${quoteIdentifier(colName)} = $${params.length}`);
    }

    const whereClause = compileWhere(this.predicates, this.metadata, "t0", params);

    // Inject discriminator predicate for single-table inheritance children
    const discPredicate = buildDiscriminatorPredicate(this.metadata, "t0", params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    let text = `UPDATE ${tableName} AS "t0" SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

    if (this.returningFields === "*") {
      text += " RETURNING *";
    } else if (this.returningFields) {
      text += ` RETURNING ${this.returningFields.map(quoteIdentifier).join(", ")}`;
    }

    const result = await this.client.query(text, params);

    const rows = this.returningFields
      ? result.rows.map((row: any) =>
          hydrateReturning<E>(row, this.metadata, { hooks: false }),
        )
      : [];

    return { rows, rowCount: result.rowCount ?? 0 };
  }
}
