import type { Predicate } from "@lindorm/types";
import type { IEntity, IDeleteQueryBuilder, WriteResult } from "../../../../interfaces";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { PredicateEntry } from "../../../types/query";
import { ProteusError } from "../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type { MysqlQueryClient } from "../types/mysql-query-client";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier";
import { buildDiscriminatorPredicateUnqualified } from "../utils/query/compile-helpers";
import { compileWhere } from "../utils/query/compile-where";
import { resolveTableName } from "../utils/query/resolve-table-name";

/**
 * MySQL DELETE query builder.
 *
 * MySQL has no RETURNING clause. The `returning()` method is accepted for API
 * compatibility but does not return hydrated rows -- only rowCount is populated.
 *
 * For soft-delete, uses `UPDATE ... SET <deleteDate> = NOW(3)`.
 */
export class MySqlDeleteQueryBuilder<
  E extends IEntity,
> implements IDeleteQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: MysqlQueryClient;
  private readonly namespace: string | null;
  private readonly isSoft: boolean;
  private predicates: Array<PredicateEntry<E>> = [];

  public constructor(
    metadata: EntityMetadata,
    client: MysqlQueryClient,
    namespace?: string | null,
    soft?: boolean,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
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

  public returning(..._fields: Array<keyof E | "*">): this {
    throw new ProteusRepositoryError(
      "MySQL does not support RETURNING clauses. Use save()/insert()/update() repository methods instead, which automatically SELECT-back after write.",
    );
  }

  public async execute(): Promise<WriteResult<E>> {
    if (this.predicates.length === 0) {
      throw new ProteusError(
        `DELETE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
      );
    }

    // Joined inheritance children require multi-table writes -- not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "DELETE via QueryBuilder is not supported for joined inheritance entities",
      );
    }

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);
    const params: Array<unknown> = [];

    // For simple DELETE/soft-delete, use unqualified column names (no alias)
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
      text = `UPDATE ${tableName} SET ${quoteIdentifier(deleteField.name)} = NOW(3) ${whereClause}${discClause}`;
    } else {
      text = `DELETE FROM ${tableName} ${whereClause}${discClause}`;
    }

    const result = await this.client.query(text, params);

    return { rows: [], rowCount: result.rowCount };
  }
}
