import type { DeepPartial, Dict, Predicate } from "@lindorm/types";
import type {
  IEntity,
  IUpdateQueryBuilder,
  WriteResult,
} from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { PredicateEntry } from "../../../types/query.js";
import { ProteusError } from "../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import type { MysqlQueryClient } from "../types/mysql-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier.js";
import { coerceWriteValue } from "../utils/query/coerce-value.js";
import { buildDiscriminatorPredicateUnqualified } from "../utils/query/compile-helpers.js";
import { compileWhere } from "../utils/query/compile-where.js";
import { resolveTableName } from "../utils/query/resolve-table-name.js";

/**
 * MySQL UPDATE query builder.
 *
 * MySQL has no RETURNING clause. The `returning()` method is accepted for API
 * compatibility but does not return hydrated rows -- only rowCount is populated.
 */
export class MySqlUpdateQueryBuilder<
  E extends IEntity,
> implements IUpdateQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: MysqlQueryClient;
  private readonly namespace: string | null;
  private data: Dict | null = null;
  private predicates: Array<PredicateEntry<E>> = [];

  public constructor(
    metadata: EntityMetadata,
    client: MysqlQueryClient,
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

  public returning(..._fields: Array<keyof E | "*">): this {
    throw new ProteusRepositoryError(
      "MySQL does not support RETURNING clauses. Use save()/insert()/update() repository methods instead, which automatically SELECT-back after write.",
    );
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

    // Joined inheritance children require multi-table writes -- not supported via QB
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
      params.push(coerceWriteValue(transformed, field?.type ?? null));
      setClauses.push(`${quoteIdentifier(colName)} = ?`);
    }

    // MySQL supports UPDATE ... AS alias, but for QB updates we use unqualified
    // column names for simplicity (no alias needed for single-table UPDATE)
    const whereClause = compileWhere(this.predicates, this.metadata, null as any, params);

    // Inject discriminator predicate for single-table inheritance children
    const discPredicate = buildDiscriminatorPredicateUnqualified(this.metadata, params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    const text = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

    const result = await this.client.query(text, params);

    return { rows: [], rowCount: result.rowCount };
  }
}
