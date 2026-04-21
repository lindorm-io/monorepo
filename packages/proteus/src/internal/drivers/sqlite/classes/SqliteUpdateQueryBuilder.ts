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
import type { SqliteQueryClient } from "../types/sqlite-query-client.js";
import { quoteIdentifier } from "../utils/quote-identifier.js";
import { coerceWriteValue } from "../utils/query/coerce-value.js";
import { buildDiscriminatorPredicateUnqualified } from "../utils/query/compile-helpers.js";
import { compileWhere } from "../utils/query/compile-where.js";
import { hydrateReturning } from "../utils/query/hydrate-returning.js";
import { resolveTableName } from "../utils/query/resolve-table-name.js";

export class SqliteUpdateQueryBuilder<
  E extends IEntity,
> implements IUpdateQueryBuilder<E> {
  private readonly metadata: EntityMetadata;
  private readonly client: SqliteQueryClient;
  private data: Dict | null = null;
  private predicates: Array<PredicateEntry<E>> = [];
  private returningFields: Array<string> | "*" | null = null;

  public constructor(
    metadata: EntityMetadata,
    client: SqliteQueryClient,
    _namespace?: string | null,
  ) {
    this.metadata = metadata;
    this.client = client;
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

    // SQLite does not support UPDATE ... AS alias — use unqualified column names
    const resolved = resolveTableName(this.metadata);
    const tableName = quoteIdentifier(resolved.name);
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

    // SQLite WHERE: no table alias
    const whereClause = compileWhere(this.predicates, this.metadata, null as any, params);

    // Inject discriminator predicate for single-table inheritance children
    const discPredicate = buildDiscriminatorPredicateUnqualified(this.metadata, params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    let text = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

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
