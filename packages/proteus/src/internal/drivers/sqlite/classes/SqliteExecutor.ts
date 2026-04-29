import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { DeleteOptions, FindOptions } from "../../../../types/index.js";
import type { EntityMetadata, QueryScope } from "../../../entity/types/metadata.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import type { SqliteQueryClient } from "../types/sqlite-query-client.js";
import { OptimisticLockError } from "../../../errors/OptimisticLockError.js";
import { SqliteExecutorError } from "../errors/SqliteExecutorError.js";
import { buildPrimaryKeyDebug } from "../../../utils/repository/build-pk-debug.js";
import { guardEmptyCriteria } from "../../../utils/repository/guard-empty-criteria.js";
import {
  compileDelete,
  compileDeleteExpired,
  compileJoinedChildDelete,
  compileRestore,
  compileSoftDelete,
} from "../utils/query/compile-delete.js";
import { compileDeleteWithLimit } from "../utils/query/compile-delete-with-limit.js";
import { compileExists } from "../utils/query/compile-exists.js";
import { compileIncrement } from "../utils/query/compile-increment.js";
import { compileInsert, compileInsertBulk } from "../utils/query/compile-insert.js";
import {
  compileJoinedInsert,
  compileJoinedUpdate,
} from "../utils/query/compile-joined-write.js";
import { compileCount, compileQuery } from "../utils/query/compile-query.js";
import { compileUpdate, compileUpdateMany } from "../utils/query/compile-update.js";
import { executeQueryIncludes } from "../utils/query/execute-query-includes.js";
import { findOptionsToQueryState } from "../../../utils/query/find-options-to-query-state.js";
import { hydrateRows } from "../utils/query/hydrate-result.js";
import {
  hydrateReturning,
  hydrateReturningRows,
} from "../utils/query/hydrate-returning.js";
import { partitionIncludes } from "../utils/query/partition-includes.js";

export class SqliteExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly client: SqliteQueryClient;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    client: SqliteQueryClient,
    metadata: EntityMetadata,
    namespace?: string | null,
    filterRegistry?: FilterRegistry,
    amphora?: IAmphora,
  ) {
    this.client = client;
    this.metadata = metadata;
    this.namespace = namespace ?? null;
    this.filterRegistry = filterRegistry ?? new Map();
    this.amphora = amphora;
  }

  public async executeInsert(entity: E): Promise<E> {
    const joined = compileJoinedInsert(
      entity,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    if (joined) {
      return this.executeJoinedInsert(entity, joined);
    }

    const { text, params } = compileInsert(
      entity,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    const rows = this.client.all(text, params);
    return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
  }

  public async executeUpdate(entity: E): Promise<E> {
    const joined = compileJoinedUpdate(
      entity,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    if (joined) {
      return this.executeJoinedUpdate(entity, joined);
    }

    const { text, params } = compileUpdate(
      entity,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    const rows = this.client.all(text, params);

    if (rows.length === 0) {
      const versionField = this.metadata.fields.find((f) => f.decorator === "Version");

      if (versionField) {
        const primaryKey = buildPrimaryKeyDebug(
          entity as Record<string, unknown>,
          this.metadata.primaryKeys,
        );
        throw new OptimisticLockError(this.metadata.entity.name, primaryKey);
      }

      throw new SqliteExecutorError(
        `Update failed: no matching row found for "${this.metadata.entity.name}"`,
        {
          debug: {
            primaryKey: buildPrimaryKeyDebug(
              entity as Record<string, unknown>,
              this.metadata.primaryKeys,
            ),
          },
        },
      );
    }

    return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
  }

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", SqliteExecutorError);

    // For joined inheritance children, explicitly delete child table rows first.
    // This avoids orphan rows when FK CASCADE constraints are missing (e.g. synchronize: false).
    // When limit is set, skip the explicit child DELETE to avoid data corruption:
    // the child DELETE has no limit, so it would delete ALL matching child rows while
    // the parent DELETE only removes N rows, leaving orphan parent rows.
    // In the limited case, rely on FK CASCADE for child cleanup.
    const childDelete = options?.limit
      ? null
      : compileJoinedChildDelete(criteria, this.metadata, this.namespace);
    let childDeletedSuccessfully = false;
    if (childDelete) {
      try {
        this.client.run(childDelete.text, childDelete.params);
        childDeletedSuccessfully = true;
      } catch {
        // Child DELETE is defense-in-depth; if it fails (e.g. criteria references
        // columns that only exist on the root table), fall through to the parent
        // DELETE which uses FK CASCADE as the primary cleanup mechanism.
      }
    }

    // When child rows were already deleted, skip the joined subquery approach
    // because the INNER JOIN would find no matching child rows. Use a direct
    // root-table-only DELETE instead, relying on the already-completed child cleanup.
    const { text, params } = options?.limit
      ? compileDeleteWithLimit(criteria, options.limit, this.metadata, this.namespace)
      : compileDelete(criteria, this.metadata, this.namespace, {
          skipJoinedContext: childDeletedSuccessfully,
        });

    this.client.run(text, params);
  }

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "soft delete", SqliteExecutorError);
    const { text, params } = compileSoftDelete(criteria, this.metadata, this.namespace);
    this.client.run(text, params);
  }

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "restore", SqliteExecutorError);
    const { text, params } = compileRestore(criteria, this.metadata, this.namespace);
    this.client.run(text, params);
  }

  public async executeDeleteExpired(): Promise<void> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return;

    const { text, params } = compileDeleteExpired(this.metadata, this.namespace);
    this.client.run(text, params);
  }

  public async executeTtl(criteria: Predicate<E>): Promise<number | null> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return null;

    const state = findOptionsToQueryState<E>(
      criteria,
      {
        select: [expiryField.key as keyof E],
        limit: 1,
      },
      this.metadata,
      "multiple",
      this.filterRegistry,
    );
    const { text, params, aliasMap } = compileQuery(state, this.metadata, this.namespace);
    const rows = this.client.all(text, params);

    if (rows.length === 0) return null;

    const hydrated = hydrateRows<E>(rows, this.metadata, aliasMap, state.includes, {
      amphora: this.amphora,
    });
    const expiryValue = (hydrated[0] as any)[expiryField.key];

    if (expiryValue === null || expiryValue === undefined) return null;

    const expiryDate = expiryValue instanceof Date ? expiryValue : new Date(expiryValue);
    const remainingMs = expiryDate.getTime() - Date.now();

    return Math.max(0, remainingMs);
  }

  public async executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    operationScope: QueryScope = "multiple",
  ): Promise<Array<E>> {
    const state = findOptionsToQueryState(
      criteria,
      options,
      this.metadata,
      operationScope,
      this.filterRegistry,
    );
    const { joinIncludes, queryIncludes } = partitionIncludes(state.includes);
    const joinState = { ...state, includes: joinIncludes };

    const { text, params, aliasMap } = compileQuery(
      joinState,
      this.metadata,
      this.namespace,
    );
    const rows = this.client.all(text, params);
    const entities = hydrateRows<E>(rows, this.metadata, aliasMap, joinIncludes, {
      amphora: this.amphora,
      snapshot: options.snapshot,
    });

    if (queryIncludes.length > 0) {
      executeQueryIncludes(entities, queryIncludes, {
        rootMetadata: this.metadata,
        client: this.client,
        namespace: this.namespace,
        withDeleted: state.withDeleted,
        versionTimestamp: state.versionTimestamp,
        amphora: this.amphora,
      });
    }

    return entities;
  }

  public async executeCount(
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> {
    const state = findOptionsToQueryState(
      criteria,
      options,
      this.metadata,
      "multiple",
      this.filterRegistry,
    );
    const { joinIncludes } = partitionIncludes(state.includes);
    const { text, params } = compileCount(
      { ...state, includes: joinIncludes },
      this.metadata,
      this.namespace,
    );
    const row = this.client.get(text, params);
    return Number((row as any)?.count ?? 0);
  }

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    const { text, params } = compileExists(criteria, this.metadata, this.namespace);
    const row = this.client.get(text, params);
    return (row as any)?.exists === 1;
  }

  public async executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    const { text, params } = compileIncrement(
      criteria,
      property,
      value,
      this.metadata,
      this.namespace,
    );
    this.client.run(text, params);
  }

  public async executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    const { text, params } = compileIncrement(
      criteria,
      property,
      -value,
      this.metadata,
      this.namespace,
    );
    this.client.run(text, params);
  }

  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      const results: Array<E> = [];
      for (const entity of entities) {
        results.push(await this.executeInsert(entity));
      }
      return results;
    }

    const { text, params } = compileInsertBulk(
      entities,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    const rows = this.client.all(text, params);
    return hydrateReturningRows<E>(rows, this.metadata, { amphora: this.amphora });
  }

  public async executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
  ): Promise<number> {
    const { text, params } = compileUpdateMany(
      criteria,
      update,
      this.metadata,
      this.namespace,
      this.amphora,
    );
    const result = this.client.run(text, params);
    return result.changes;
  }

  // ─── Private: Joined Inheritance Write Operations ─────────────────────

  private executeJoinedInsert(
    _entity: E,
    joined: ReturnType<typeof compileJoinedInsert> & {},
  ): E {
    // Step 1: INSERT into root table
    const rootRows = this.client.all(joined.rootSql.text, joined.rootSql.params);
    const rootRow = rootRows[0];

    if (!rootRow) {
      throw new SqliteExecutorError(
        `Joined insert failed: root INSERT returned no rows for "${this.metadata.entity.name}"`,
      );
    }

    // Step 2: INSERT into child table
    const childParams = [...joined.childSql.params];
    for (const [pkKey, paramIndex] of joined.childPkParamIndices) {
      const pkField = this.metadata.fields.find((f) => f.key === pkKey);
      const pkColName = pkField?.name ?? pkKey;
      childParams[paramIndex] = rootRow[pkColName];
    }

    const childRows = this.client.all(joined.childSql.text, childParams);
    const childRow = childRows[0] ?? {};

    const mergedRow = { ...rootRow, ...childRow };
    return hydrateReturning<E>(mergedRow, this.metadata, { amphora: this.amphora });
  }

  private executeJoinedUpdate(
    entity: E,
    joined: ReturnType<typeof compileJoinedUpdate> & {},
  ): E {
    let rootRow: Record<string, unknown> = {};
    let childRow: Record<string, unknown> = {};

    if (joined.rootSql) {
      const rootRows = this.client.all(joined.rootSql.text, joined.rootSql.params);

      if (rootRows.length === 0) {
        const versionField = this.metadata.fields.find((f) => f.decorator === "Version");

        if (versionField) {
          const primaryKey = buildPrimaryKeyDebug(
            entity as Record<string, unknown>,
            this.metadata.primaryKeys,
          );
          throw new OptimisticLockError(this.metadata.entity.name, primaryKey);
        }

        throw new SqliteExecutorError(
          `Update failed: no matching row found for "${this.metadata.entity.name}"`,
          {
            debug: {
              primaryKey: buildPrimaryKeyDebug(
                entity as Record<string, unknown>,
                this.metadata.primaryKeys,
              ),
            },
          },
        );
      }

      rootRow = rootRows[0] ?? {};
    }

    if (joined.childSql) {
      const childRows = this.client.all(joined.childSql.text, joined.childSql.params);
      childRow = childRows[0] ?? {};
    }

    if (!joined.rootSql && !joined.childSql) {
      throw new SqliteExecutorError(
        `Joined update produced no SQL statements for "${this.metadata.entity.name}"`,
      );
    }

    const mergedRow = { ...rootRow, ...childRow };
    return hydrateReturning<E>(mergedRow, this.metadata, { amphora: this.amphora });
  }
}
