import type { Predicate } from "@lindorm/types";
import type {
  IEntity,
  IDeleteQueryBuilder,
  WriteResult,
} from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { PredicateEntry } from "../../../types/query.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { ProteusError } from "../../../../errors/ProteusError.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier.js";
import { compileWhere } from "../utils/query/compile-where.js";
import { hydrateReturning } from "../utils/query/hydrate-returning.js";
import {
  buildDiscriminatorPredicate,
  resolveTableName,
} from "../utils/query/resolve-table-name.js";

export class PostgresDeleteQueryBuilder<
  E extends IEntity,
> implements IDeleteQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: PostgresQueryClient;
  private readonly namespace: string | null;
  private readonly isSoft: boolean;
  private predicates: Array<PredicateEntry<E>> = [];
  private returningFields: Array<string> | "*" | null = null;

  constructor(
    metadata: EntityMetadata,
    client: PostgresQueryClient,
    namespace?: string | null,
    soft?: boolean,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
    this.isSoft = soft ?? false;
  }

  where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
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
    if (this.predicates.length === 0) {
      throw new ProteusError(
        `DELETE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
        {
          code: "invalid_query",
          title: "Invalid Query",
          details: `DELETE on "${this.metadata.entity.name}" was rejected because it has no where() predicate, which would delete every row.`,
          data: { entity: this.metadata.entity.name, operation: "delete.execute" },
        },
      );
    }

    // Joined inheritance children require multi-table writes — not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "DELETE via QueryBuilder is not supported for joined inheritance entities",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details: `Joined-inheritance entity "${this.metadata.entity.name}" spans multiple tables and cannot be deleted via the query builder; use repository.delete() instead.`,
          data: { operation: "delete.execute", entity: this.metadata.entity.name },
        },
      );
    }

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);
    const params: Array<unknown> = [];
    const whereClause = compileWhere(this.predicates, this.metadata, "t0", params);

    // Inject discriminator predicate for single-table inheritance children
    const discPredicate = buildDiscriminatorPredicate(this.metadata, "t0", params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    let text: string;

    if (this.isSoft) {
      const deleteField = this.metadata.fields.find((f) => f.decorator === "DeleteDate");
      if (!deleteField) {
        throw new ProteusError(
          `Entity "${this.metadata.entity.name}" has no @DeleteDateField — cannot use softDelete()`,
          {
            code: "invalid_query",
            title: "Invalid Query",
            details: `Entity "${this.metadata.entity.name}" declares no @DeleteDateField column, so softDelete() has nothing to set.`,
            data: { entity: this.metadata.entity.name, operation: "delete.softDelete" },
          },
        );
      }
      text = `UPDATE ${tableName} AS "t0" SET ${quoteIdentifier(deleteField.name)} = NOW() ${whereClause}${discClause}`;
    } else {
      text = `DELETE FROM ${tableName} AS "t0" ${whereClause}${discClause}`;
    }

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
