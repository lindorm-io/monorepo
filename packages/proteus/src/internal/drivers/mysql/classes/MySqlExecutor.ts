import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type { DeleteOptions, FindOptions } from "../../../../types";
import type { EntityMetadata, QueryScope } from "../../../entity/types/metadata";
import type { FilterRegistry } from "../../../utils/query/filter-registry";
import type { MysqlQueryClient } from "../types/mysql-query-client";
import { OptimisticLockError } from "../../../errors/OptimisticLockError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { MySqlExecutorError } from "../errors/MySqlExecutorError";
import { buildPrimaryKeyDebug } from "../../../utils/repository/build-pk-debug";
import { wrapMysqlError } from "../utils/repository/wrap-mysql-error";
import { guardEmptyCriteria } from "../../../utils/repository/guard-empty-criteria";
import { compileDelete, compileJoinedChildDelete } from "../utils/query/compile-delete";
import {
  compileDeleteExpired,
  compileRestore,
  compileSoftDelete,
} from "../utils/query/compile-update";
import { compileDeleteWithLimit } from "../utils/query/compile-delete-with-limit";
import { compileExists } from "../utils/query/compile-exists";
import { compileIncrement } from "../utils/query/compile-increment";
import { compileInsert, compileInsertBulk } from "../utils/query/compile-insert";
import {
  compileJoinedInsert,
  compileJoinedUpdate,
} from "../utils/query/compile-joined-write";
import { compileCount, compileQuery } from "../utils/query/compile-query";
import { compileUpdate, compileUpdateMany } from "../utils/query/compile-update";
import {
  compileSelectByPk,
  compileSelectByPkBatch,
  compileSelectByPkStartLimit,
  compileSelectByPkValues,
} from "../utils/query/compile-select-by-pk";
import { executeQueryIncludes } from "../utils/query/execute-query-includes";
import { findOptionsToQueryState } from "../../../utils/query/find-options-to-query-state";
import { hydrateRows } from "../utils/query/hydrate-result";
import { hydrateReturning } from "../utils/query/hydrate-returning";
import { partitionIncludes } from "../utils/query/partition-includes";

export class MySqlExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly client: MysqlQueryClient;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    client: MysqlQueryClient,
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
    try {
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
      const insertResult = await this.client.query(text, params);

      // For AUTO_INCREMENT PKs, use insertId from the result
      const autoIncrementGen = this.metadata.generated.find(
        (g) => g.strategy === "increment" && this.metadata.primaryKeys.includes(g.key),
      );
      const pkField = autoIncrementGen
        ? this.metadata.fields.find((f) => f.key === autoIncrementGen.key)
        : undefined;

      let selectSql;
      if (pkField && insertResult.insertId > 0) {
        selectSql = compileSelectByPkValues(
          [insertResult.insertId],
          this.metadata,
          this.namespace,
        );
      } else {
        selectSql = compileSelectByPk(entity, this.metadata, this.namespace);
      }

      const { rows } = await this.client.query(selectSql.text, selectSql.params);
      return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeInsert failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeUpdate(entity: E): Promise<E> {
    try {
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

        throw new MySqlExecutorError(
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

      const selectSql = compileSelectByPk(entity, this.metadata, this.namespace);
      const { rows } = await this.client.query(selectSql.text, selectSql.params);
      return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeUpdate failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", MySqlExecutorError);

    try {
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

      // When child rows were already deleted, skip the multi-table JOIN approach
      // because the JOIN would find no matching child rows. Use a direct
      // root-table-only DELETE instead.
      const { text, params } = options?.limit
        ? compileDeleteWithLimit(criteria, options.limit, this.metadata, this.namespace)
        : compileDelete(criteria, this.metadata, this.namespace, {
            skipJoinedContext: childDeletedSuccessfully,
          });

      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeDelete failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "soft delete", MySqlExecutorError);
    try {
      const { text, params } = compileSoftDelete(criteria, this.metadata, this.namespace);
      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeSoftDelete failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "restore", MySqlExecutorError);
    try {
      const { text, params } = compileRestore(criteria, this.metadata, this.namespace);
      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeRestore failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeDeleteExpired(): Promise<void> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return;

    try {
      const { text, params } = compileDeleteExpired(this.metadata, this.namespace);
      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeDeleteExpired failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeTtl(criteria: Predicate<E>): Promise<number | null> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return null;

    try {
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
      const { text, params, aliasMap } = compileQuery(
        state,
        this.metadata,
        this.namespace,
      );
      const { rows } = await this.client.query(text, params);

      if (rows.length === 0) return null;

      const hydrated = hydrateRows<E>(rows, this.metadata, aliasMap, state.includes, {
        amphora: this.amphora,
      });
      const expiryValue = (hydrated[0] as any)[expiryField.key];

      if (expiryValue === null || expiryValue === undefined) return null;

      const expiryDate =
        expiryValue instanceof Date ? expiryValue : new Date(expiryValue);
      const remainingMs = expiryDate.getTime() - Date.now();

      return Math.max(0, remainingMs);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeTtl failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    operationScope: QueryScope = "multiple",
  ): Promise<Array<E>> {
    try {
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
      const { rows } = await this.client.query(text, params);
      const entities = hydrateRows<E>(rows, this.metadata, aliasMap, joinIncludes, {
        amphora: this.amphora,
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
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeFind failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeCount(
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> {
    try {
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
      const { rows } = await this.client.query(text, params);
      return Number((rows[0] as any)?.count ?? 0);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeCount failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    try {
      const { text, params } = compileExists(criteria, this.metadata, this.namespace);
      const { rows } = await this.client.query(text, params);
      return (rows[0] as any)?.exists === 1;
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeExists failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    try {
      const { text, params } = compileIncrement(
        criteria,
        property,
        value,
        this.metadata,
        this.namespace,
      );
      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeIncrement failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    try {
      const { text, params } = compileIncrement(
        criteria,
        property,
        -value,
        this.metadata,
        this.namespace,
      );
      await this.client.query(text, params);
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeDecrement failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    try {
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
      const insertResult = await this.client.query(text, params);

      // After bulk insert, SELECT back all rows by PK
      // For AUTO_INCREMENT: insertId is the first generated ID, subsequent IDs are contiguous
      const autoIncrementGen = this.metadata.generated.find(
        (g) => g.strategy === "increment" && this.metadata.primaryKeys.includes(g.key),
      );
      const pkField = autoIncrementGen
        ? this.metadata.fields.find((f) => f.key === autoIncrementGen.key)
        : undefined;

      if (pkField && insertResult.insertId > 0) {
        // AUTO_INCREMENT: insertId is the first generated ID.
        // IDs may not be contiguous under innodb_autoinc_lock_mode=2 (MySQL 8 default),
        // so we use >= firstId ORDER BY pk ASC LIMIT N instead of BETWEEN.
        const firstId = insertResult.insertId;
        const selectSql = compileSelectByPkStartLimit(
          pkField.name,
          firstId,
          entities.length,
          this.metadata,
          this.namespace,
        );
        const { rows } = await this.client.query(selectSql.text, selectSql.params);

        if (rows.length !== entities.length) {
          throw new ProteusRepositoryError(
            `Bulk insert SELECT-back mismatch: expected ${entities.length} rows but got ${rows.length}. ` +
              `This may indicate non-contiguous AUTO_INCREMENT IDs under innodb_autoinc_lock_mode=2.`,
            { debug: { firstId, expected: entities.length, actual: rows.length } },
          );
        }

        return rows.map((row) =>
          hydrateReturning<E>(row, this.metadata, {
            hooks: false,
            amphora: this.amphora,
          }),
        );
      }

      // Non-AUTO_INCREMENT: batch SELECT back all PKs in a single IN (...) query
      const selectSql = compileSelectByPkBatch(entities, this.metadata, this.namespace);
      const { rows } = await this.client.query(selectSql.text, selectSql.params);

      // Match results back to input order by building a lookup map
      const pkKeys = this.metadata.primaryKeys;
      const buildKey = (record: Record<string, unknown>): string =>
        pkKeys
          .map((pk) => {
            const field = this.metadata.fields.find((f) => f.key === pk);
            const colName = field?.name ?? pk;
            // Use entity key for input entities, column name for DB rows
            return String(record[pk] ?? record[colName] ?? "");
          })
          .join("\0");

      const rowMap = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        rowMap.set(buildKey(row), row);
      }

      const results: Array<E> = [];
      for (const entity of entities) {
        const key = buildKey(entity as Record<string, unknown>);
        const row = rowMap.get(key);
        if (row) {
          results.push(
            hydrateReturning<E>(row, this.metadata, {
              hooks: false,
              amphora: this.amphora,
            }),
          );
        }
      }
      return results;
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeInsertBulk failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  public async executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
  ): Promise<number> {
    try {
      const { text, params } = compileUpdateMany(
        criteria,
        update,
        this.metadata,
        this.namespace,
        this.amphora,
      );
      const result = await this.client.query(text, params);
      return result.rowCount;
    } catch (error) {
      return wrapMysqlError(
        error,
        `executeUpdateMany failed for "${this.metadata.entity.name}"`,
      );
    }
  }

  // ─── Private: Joined Inheritance Write Operations ─────────────────────

  private async executeJoinedInsert(
    entity: E,
    joined: ReturnType<typeof compileJoinedInsert> & {},
  ): Promise<E> {
    // Step 1: INSERT into root table
    const rootResult = await this.client.query(
      joined.rootSql.text,
      joined.rootSql.params,
    );

    // Step 2: Patch child PK params with generated values (AUTO_INCREMENT)
    const childParams = [...joined.childSql.params];
    const autoIncrementGen = this.metadata.generated.find(
      (g) => g.strategy === "increment" && this.metadata.primaryKeys.includes(g.key),
    );
    const pkField = autoIncrementGen
      ? this.metadata.fields.find((f) => f.key === autoIncrementGen.key)
      : undefined;

    if (pkField && rootResult.insertId > 0) {
      for (const [pkKey, paramIndex] of joined.childPkParamIndices) {
        if (pkKey === pkField.key) {
          childParams[paramIndex] = rootResult.insertId;
        }
      }
    }

    // Step 3: INSERT into child table
    await this.client.query(joined.childSql.text, childParams);

    // Step 4: SELECT-back the complete entity from root table
    const pkValues = this.metadata.primaryKeys.map((pk) => {
      if (pkField && pk === pkField.key && rootResult.insertId > 0) {
        return rootResult.insertId;
      }
      return (entity as any)[pk];
    });

    const selectSql = compileSelectByPkValues(pkValues, this.metadata, this.namespace);
    const { rows } = await this.client.query(selectSql.text, selectSql.params);

    if (!rows[0]) {
      throw new MySqlExecutorError(
        `Joined insert failed: SELECT-back returned no rows for "${this.metadata.entity.name}"`,
      );
    }

    return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
  }

  private async executeJoinedUpdate(
    entity: E,
    joined: ReturnType<typeof compileJoinedUpdate> & {},
  ): Promise<E> {
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

        throw new MySqlExecutorError(
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
    }

    if (joined.childSql) {
      await this.client.query(joined.childSql.text, joined.childSql.params);
    }

    if (!joined.rootSql && !joined.childSql) {
      throw new MySqlExecutorError(
        `Joined update produced no SQL statements for "${this.metadata.entity.name}"`,
      );
    }

    // SELECT-back the complete entity
    const selectSql = compileSelectByPk(entity, this.metadata, this.namespace);
    const { rows } = await this.client.query(selectSql.text, selectSql.params);
    return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
  }
}
