import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { DeleteOptions, FindOptions } from "../../../../types/index.js";
import type { EntityMetadata, QueryScope } from "../../../entity/types/metadata.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import { OptimisticLockError } from "../../../errors/OptimisticLockError.js";
import { PostgresExecutorError } from "../errors/PostgresExecutorError.js";
import { buildPrimaryKeyDebug } from "../../../utils/repository/build-pk-debug.js";
import { guardEmptyCriteria } from "../../../utils/repository/guard-empty-criteria.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
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

export class PostgresExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly client: PostgresQueryClient;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    client: PostgresQueryClient,
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
    // For joined inheritance children, perform multi-table INSERT
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
    const result = await this.client.query(text, params);
    return hydrateReturning<E>(result.rows[0], this.metadata, { amphora: this.amphora });
  }

  public async executeUpdate(entity: E): Promise<E> {
    // For joined inheritance children, perform multi-table UPDATE
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
    const result = await this.client.query(text, params);

    if (result.rowCount === 0) {
      const versionField = this.metadata.fields.find((f) => f.decorator === "Version");

      if (versionField) {
        const primaryKey = buildPrimaryKeyDebug(
          entity as Record<string, unknown>,
          this.metadata.primaryKeys,
        );
        throw new OptimisticLockError(this.metadata.entity.name, primaryKey);
      }

      throw new PostgresExecutorError(
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

    return hydrateReturning<E>(result.rows[0], this.metadata, { amphora: this.amphora });
  }

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", PostgresExecutorError);

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
        await this.client.query(childDelete.text, childDelete.params);
        childDeletedSuccessfully = true;
      } catch {
        // Child DELETE is defense-in-depth; if it fails (e.g. criteria references
        // columns that only exist on the root table), fall through to the parent
        // DELETE which uses FK CASCADE as the primary cleanup mechanism.
      }
    }

    // When child rows were already deleted, skip the USING/JOIN approach
    // because the JOIN would find no matching child rows. Use a direct
    // root-table-only DELETE instead.
    const { text, params } = options?.limit
      ? compileDeleteWithLimit(criteria, options.limit, this.metadata, this.namespace)
      : compileDelete(criteria, this.metadata, this.namespace, {
          skipJoinedContext: childDeletedSuccessfully,
        });

    await this.client.query(text, params);
  }

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "soft delete", PostgresExecutorError);
    const { text, params } = compileSoftDelete(criteria, this.metadata, this.namespace);
    await this.client.query(text, params);
  }

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "restore", PostgresExecutorError);
    const { text, params } = compileRestore(criteria, this.metadata, this.namespace);
    await this.client.query(text, params);
  }

  public async executeDeleteExpired(): Promise<void> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return;

    const { text, params } = compileDeleteExpired(this.metadata, this.namespace);
    await this.client.query(text, params);
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
    const result = await this.client.query(text, params);

    if (result.rows.length === 0) return null;

    const rows = hydrateRows<E>(result.rows, this.metadata, aliasMap, state.includes, {
      amphora: this.amphora,
    });
    const expiryValue = (rows[0] as any)[expiryField.key];

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
    const result = await this.client.query(text, params);
    const entities = hydrateRows<E>(result.rows, this.metadata, aliasMap, joinIncludes, {
      amphora: this.amphora,
      snapshot: options.snapshot,
    });

    if (queryIncludes.length > 0) {
      await executeQueryIncludes(entities, queryIncludes, {
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
    const result = await this.client.query(text, params);
    return Number(result.rows[0]?.count ?? 0);
  }

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    const { text, params } = compileExists(criteria, this.metadata, this.namespace);
    const result = await this.client.query(text, params);
    return result.rows[0]?.exists === true;
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
    await this.client.query(text, params);
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
    await this.client.query(text, params);
  }

  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    // For joined inheritance, fall back to individual inserts
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
    const result = await this.client.query(text, params);
    return hydrateReturningRows<E>(result.rows, this.metadata, { amphora: this.amphora });
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
    const result = await this.client.query(text, params);
    return result.rowCount ?? 0;
  }

  // ─── Private: Joined Inheritance Write Operations ─────────────────────

  /**
   * Execute a multi-table INSERT for joined inheritance children.
   * 1. INSERT into root table (root fields + discriminator)
   * 2. INSERT into child table (child fields + PK)
   * Both run on the same client connection (which may already be in a transaction).
   */
  private async executeJoinedInsert(
    _entity: E,
    joined: ReturnType<typeof compileJoinedInsert> & {},
  ): Promise<E> {
    // Step 1: INSERT into root table
    const rootResult = await this.client.query(
      joined.rootSql.text,
      joined.rootSql.params,
    );
    const rootRow = rootResult.rows[0];

    if (!rootRow) {
      throw new PostgresExecutorError(
        `Joined insert failed: root INSERT returned no rows for "${this.metadata.entity.name}"`,
      );
    }

    // Step 2: INSERT into child table
    // Patch PK params in child SQL from root RETURNING values (in case of generated PKs).
    // Uses explicit param indices from the compiler to avoid positional assumptions.
    const childParams = [...joined.childSql.params];
    for (const [pkKey, paramIndex] of joined.childPkParamIndices) {
      const pkField = this.metadata.fields.find((f) => f.key === pkKey);
      const pkColName = pkField?.name ?? pkKey;
      childParams[paramIndex] = rootRow[pkColName];
    }

    const childResult = await this.client.query(joined.childSql.text, childParams);
    const childRow = childResult.rows[0] ?? {};

    // Merge both RETURNING rows and hydrate
    const mergedRow = { ...rootRow, ...childRow };
    return hydrateReturning<E>(mergedRow, this.metadata, { amphora: this.amphora });
  }

  /**
   * Execute a multi-table UPDATE for joined inheritance children.
   * 1. UPDATE root table (root fields, optimistic lock check)
   * 2. UPDATE child table (child fields)
   * Both run on the same client connection.
   */
  private async executeJoinedUpdate(
    entity: E,
    joined: ReturnType<typeof compileJoinedUpdate> & {},
  ): Promise<E> {
    let rootRow: Record<string, unknown> = {};
    let childRow: Record<string, unknown> = {};

    // Step 1: UPDATE root table (if there are root fields to update)
    if (joined.rootSql) {
      const rootResult = await this.client.query(
        joined.rootSql.text,
        joined.rootSql.params,
      );

      if (rootResult.rowCount === 0) {
        const versionField = this.metadata.fields.find((f) => f.decorator === "Version");

        if (versionField) {
          const primaryKey = buildPrimaryKeyDebug(
            entity as Record<string, unknown>,
            this.metadata.primaryKeys,
          );
          throw new OptimisticLockError(this.metadata.entity.name, primaryKey);
        }

        throw new PostgresExecutorError(
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

      rootRow = rootResult.rows[0] ?? {};
    }

    // Step 2: UPDATE child table (if there are child fields to update)
    if (joined.childSql) {
      const childResult = await this.client.query(
        joined.childSql.text,
        joined.childSql.params,
      );
      childRow = childResult.rows[0] ?? {};
    }

    // If neither root nor child had updates, fetch the current state
    if (!joined.rootSql && !joined.childSql) {
      throw new PostgresExecutorError(
        `Joined update produced no SQL statements for "${this.metadata.entity.name}"`,
      );
    }

    // Merge both RETURNING rows and hydrate
    const mergedRow = { ...rootRow, ...childRow };
    return hydrateReturning<E>(mergedRow, this.metadata, { amphora: this.amphora });
  }
}
