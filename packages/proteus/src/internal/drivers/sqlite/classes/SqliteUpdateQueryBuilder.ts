import type { IAmphora } from "@lindorm/amphora";
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
import type { SqliteQueryClient } from "../types/sqlite-query-client.js";
import { quoteIdentifier } from "../utils/quote-identifier.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { dehydrateTypedJson } from "../../../entity/utils/typed-json.js";
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
  private readonly amphora: IAmphora | undefined;
  private data: Dict | null = null;
  private predicates: Array<PredicateEntry<E>> = [];
  private returningFields: Array<string> | "*" | null = null;

  constructor(
    metadata: EntityMetadata,
    client: SqliteQueryClient,
    _namespace?: string | null,
    amphora?: IAmphora,
  ) {
    this.metadata = metadata;
    this.client = client;
    this.amphora = amphora;
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
    if (!this.data || Object.keys(this.data).length === 0) {
      return { rows: [], rowCount: 0 };
    }

    if (this.predicates.length === 0) {
      throw new ProteusError(
        `UPDATE on "${this.metadata.entity.name}" requires at least one .where() predicate`,
        {
          code: "invalid_query",
          title: "Invalid Query",
          details: "An UPDATE query must include at least one where() predicate.",
          data: { entity: this.metadata.entity.name, operation: "update.execute" },
        },
      );
    }

    // Joined inheritance children require multi-table writes — not supported via QB
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
            "UPDATE via the query builder is not supported for joined inheritance entities.",
          data: { operation: "update.execute", entity: this.metadata.entity.name },
        },
      );
    }

    // SQLite does not support UPDATE ... AS alias — use unqualified column names
    const resolved = resolveTableName(this.metadata);
    const tableName = quoteIdentifier(resolved.name);
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
        const { data, meta } = dehydrateTypedJson(
          field,
          value,
          this.amphora,
          this.metadata.entity.name,
        );
        pushSet(field.name, coerceWriteValue(data, field?.type ?? null));
        pushSet(field.typedJson.column, meta);
        continue;
      }

      // A builder write bypasses the ORM lifecycle but not the storage contract:
      // an @Encrypted column holds ciphertext, so writing the plaintext here
      // would leak it and make the read path fail to open it.
      pushSet(
        field?.name ?? key,
        dehydrateFieldValue(value, field, this.metadata.entity.name, {
          amphora: this.amphora,
          coerce: (v) => coerceWriteValue(v, field?.type ?? null),
        }),
      );
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
        hydrateReturning<E>(row, this.metadata, {
          hooks: false,
          amphora: this.amphora,
        }),
      );
      return { rows, rowCount: resultRows.length };
    }

    const result = this.client.run(text, params);
    return { rows: [], rowCount: result.changes };
  }
}
