import type { Condition } from "@lindorm/match";
import type { DeepPartial, Dict } from "@lindorm/types";
import type {
  IEntity,
  IUpdateQueryBuilder,
  WriteResult,
} from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { PredicateEntry } from "../../../types/query.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { ProteusError } from "../../../../errors/ProteusError.js";
import type { MysqlQueryClient } from "../types/mysql-query-client.js";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier.js";
import { dehydrateTypedJson } from "../../../entity/utils/typed-json.js";
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

  constructor(
    metadata: EntityMetadata,
    client: MysqlQueryClient,
    namespace?: string | null,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.namespace = namespace ?? null;
  }

  set(data: DeepPartial<E>): this {
    this.data = data as Dict;
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

  returning(..._fields: Array<keyof E | "*">): this {
    throw new ProteusRepositoryError(
      "MySQL does not support RETURNING clauses. Use save()/insert()/update() repository methods instead, which automatically SELECT-back after write.",
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "MySQL does not support RETURNING clauses; use repository write methods that SELECT-back after writing.",
        data: { operation: "update.returning" },
      },
    );
  }

  async execute(): Promise<WriteResult<E>> {
    if (!this.data || Object.keys(this.data).length === 0) {
      return { rows: [], rowCount: 0 };
    }

    if (this.predicates.length === 0) {
      throw new ProteusError(
        `UPDATE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
        {
          code: "invalid_query",
          title: "Invalid Query",
          details:
            "An UPDATE requires at least one where() predicate to scope the affected rows.",
          data: { entity: this.metadata.entity.name, operation: "update.execute" },
        },
      );
    }

    // Joined inheritance children require multi-table writes -- not supported via QB
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        "UPDATE via QueryBuilder is not supported for joined inheritance entities",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "UPDATE via the query builder is not supported for joined inheritance entities; use repository.update().",
          data: { operation: "update.execute", entity: this.metadata.entity.name },
        },
      );
    }

    const resolved = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(resolved.schema, resolved.name);
    const params: Array<unknown> = [];
    const setClauses: Array<string> = [];

    const pushSet = (column: string, value: unknown): void => {
      params.push(value);
      setClauses.push(`${quoteIdentifier(column)} = ?`);
    };

    for (const [key, value] of Object.entries(this.data)) {
      const field = this.metadata.fields.find((f) => f.key === key);

      // A @TypedJson field owns two columns. Setting the data column alone left
      // the previous row's sidecar in place, so the fresh data was rejoined
      // against stale type metadata and hydrated as mistyped values.
      if (field?.typedJson) {
        // No amphora reaches a query builder, so an @Encrypted field is written
        // in the clear here — the same gap the branch below already has. Use
        // repository.update() for encrypted entities.
        const { data, meta } = dehydrateTypedJson(
          field,
          value,
          undefined,
          this.metadata.entity.name,
        );
        pushSet(field.name, coerceWriteValue(data, field?.type ?? null));
        pushSet(field.typedJson.column, meta);
        continue;
      }

      let transformed = value;
      if (field?.transform) {
        transformed = field.transform.to(transformed);
      }
      pushSet(field?.name ?? key, coerceWriteValue(transformed, field?.type ?? null));
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
