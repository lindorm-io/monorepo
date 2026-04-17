import type { Predicate } from "@lindorm/types";
import type { IEntity, IDeleteQueryBuilder, WriteResult } from "../../../../interfaces";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { PredicateEntry } from "../../../types/query";
import { ProteusError } from "../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type { SqliteQueryClient } from "../types/sqlite-query-client";
import { quoteIdentifier } from "../utils/quote-identifier";
import { buildDiscriminatorPredicateUnqualified } from "../utils/query/compile-helpers";
import { compileWhere } from "../utils/query/compile-where";
import { hydrateReturning } from "../utils/query/hydrate-returning";
import { resolveTableName } from "../utils/query/resolve-table-name";

export class SqliteDeleteQueryBuilder<
  E extends IEntity,
> implements IDeleteQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: SqliteQueryClient;
  private readonly isSoft: boolean;
  private predicates: Array<PredicateEntry<E>> = [];
  private returningFields: Array<string> | "*" | null = null;

  public constructor(
    metadata: EntityMetadata,
    client: SqliteQueryClient,
    _namespace?: string | null,
    soft?: boolean,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.isSoft = soft ?? false;
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
    if (this.predicates.length === 0) {
      throw new ProteusError(
        `DELETE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
      );
    }

    // Joined inheritance children require multi-table writes — not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "DELETE via QueryBuilder is not supported for joined inheritance entities",
      );
    }

    // SQLite does not support DELETE ... AS alias — use unqualified column names
    const resolved = resolveTableName(this.metadata);
    const tableName = quoteIdentifier(resolved.name);
    const params: Array<unknown> = [];
    const whereClause = compileWhere(this.predicates, this.metadata, null as any, params);

    // Inject discriminator predicate for single-table inheritance children
    const discPredicate = buildDiscriminatorPredicateUnqualified(this.metadata, params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    let text: string;

    if (this.isSoft) {
      const deleteField = this.metadata.fields.find((f) => f.decorator === "DeleteDate");
      if (!deleteField) {
        throw new ProteusError(
          `Entity "${this.metadata.entity.name}" has no @DeleteDateField — cannot use softDelete()`,
        );
      }
      text = `UPDATE ${tableName} SET ${quoteIdentifier(deleteField.name)} = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ${whereClause}${discClause}`;
    } else {
      text = `DELETE FROM ${tableName} ${whereClause}${discClause}`;
    }

    if (this.returningFields === "*") {
      text += " RETURNING *";
    } else if (this.returningFields) {
      text += ` RETURNING ${this.returningFields.map(quoteIdentifier).join(", ")}`;
    }

    if (this.returningFields) {
      const resultRows = this.client.all(text, params);
      const rows = resultRows.map((row: any) =>
        hydrateReturning<E>(row, this.metadata, { hooks: false }),
      );
      return { rows, rowCount: resultRows.length };
    }

    const result = this.client.run(text, params);
    return { rows: [], rowCount: result.changes };
  }
}
