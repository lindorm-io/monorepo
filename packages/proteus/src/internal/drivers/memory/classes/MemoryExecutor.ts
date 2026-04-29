import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { DeleteOptions, FindOptions } from "../../../../types/index.js";
import type { EntityMetadata, QueryScope } from "../../../entity/types/metadata.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import type { MemoryStore, MemoryTable } from "../types/memory-store.js";
import { Predicated } from "@lindorm/utils";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";
import { encryptFieldValue } from "../../../entity/utils/encrypt-field-value.js";
import { resolvePolymorphicMetadata } from "../../../entity/utils/resolve-polymorphic-metadata.js";
import { generateAutoFilters } from "../../../entity/metadata/auto-filters.js";
import {
  matchesRow,
  applySelect,
  applyResolvedFilters,
  applyPagination,
} from "../../../utils/query/in-memory-row-ops.js";
import { mergeSystemFilterOverrides } from "../../../utils/query/merge-system-filter-overrides.js";
import { resolveFilters } from "../../../utils/query/resolve-filters.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";
import { MemoryOptimisticLockError } from "../errors/MemoryOptimisticLockError.js";
import { MemoryDriverError } from "../errors/MemoryDriverError.js";
import { applyOrdering } from "../../../utils/query/apply-ordering.js";
import { buildPrimaryKeyDebug } from "../../../utils/repository/build-pk-debug.js";
import { guardEmptyCriteria } from "../../../utils/repository/guard-empty-criteria.js";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria.js";
import { applyAutoIncrement } from "../utils/memory-auto-increment.js";
import { checkUniqueConstraints } from "../utils/memory-unique-check.js";
import { guardMemoryLockMode } from "../utils/guard-memory-lock-mode.js";

const serializePk = (
  entity: Record<string, unknown>,
  primaryKeys: Array<string>,
): string => JSON.stringify(primaryKeys.map((k) => entity[k]));

const dehydrateToRow = (
  entity: IEntity,
  metadata: EntityMetadata,
  amphora?: IAmphora,
): Dict => {
  const row: Dict = {};

  for (const field of metadata.fields) {
    if (field.computed) continue;

    let value: unknown;
    if (field.embedded) {
      const parentObj = (entity as any)[field.embedded.parentKey];
      const nestedKey = field.key.split(".")[1];
      value = parentObj != null ? parentObj[nestedKey] : null;
    } else {
      value = (entity as any)[field.key];
    }

    value = value != null && field.transform ? field.transform.to(value) : value;
    if (value != null && field.encrypted && amphora) {
      value = encryptFieldValue(value, field.encrypted.predicate, amphora);
    }
    row[field.key] = value;
  }

  // Extract FK columns from owning relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey] of Object.entries(relation.joinKeys)) {
      if (localKey in row) continue;
      row[localKey] = (entity as any)[localKey] ?? null;
    }
  }

  // Stamp discriminator value for single-table inheritance children
  if (metadata.inheritance?.discriminatorValue != null) {
    row[metadata.inheritance.discriminatorField] =
      metadata.inheritance.discriminatorValue;
  }

  return row;
};

const hydrateFromRow = <E extends IEntity>(
  row: Dict,
  metadata: EntityMetadata,
  amphora?: IAmphora,
  snapshot?: boolean,
): E => {
  const effectiveMetadata = resolvePolymorphicMetadata(row, metadata);
  return defaultHydrateEntity<E>(row, effectiveMetadata, {
    snapshot: snapshot ?? true,
    hooks: true,
    amphora,
  });
};

export class MemoryExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly metadata: EntityMetadata;
  private readonly getTable: () => MemoryTable;
  private readonly getStore: () => MemoryStore;
  private readonly deleteFieldKey: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    metadata: EntityMetadata,
    getTable: () => MemoryTable,
    getStore: () => MemoryStore,
    filterRegistry?: FilterRegistry,
    amphora?: IAmphora,
  ) {
    this.metadata = metadata;
    this.getTable = getTable;
    this.getStore = getStore;
    // deleteFieldKey is only used for write operations (softDelete, restore)
    this.deleteFieldKey =
      metadata.fields.find((f) => f.decorator === "DeleteDate")?.key ?? null;
    this.filterRegistry = filterRegistry ?? new Map();
    this.amphora = amphora;
  }

  public async executeInsert(entity: E): Promise<E> {
    const table = this.getTable();
    const row = dehydrateToRow(entity, this.metadata, this.amphora);

    applyAutoIncrement(row, this.metadata, this.getStore, true);

    const pk = serializePk(row, this.metadata.primaryKeys);

    if (table.has(pk)) {
      throw new MemoryDuplicateKeyError(
        `Duplicate primary key for "${this.metadata.entity.name}": ${pk}`,
        { debug: { entityName: this.metadata.entity.name, primaryKey: pk } },
      );
    }

    checkUniqueConstraints(table, row, this.metadata, null);

    table.set(pk, structuredClone(row));

    return hydrateFromRow<E>(structuredClone(row), this.metadata, this.amphora);
  }

  public async executeUpdate(entity: E): Promise<E> {
    const table = this.getTable();
    const row = dehydrateToRow(entity, this.metadata, this.amphora);

    const pkForLookup = serializePk(
      Object.fromEntries(this.metadata.primaryKeys.map((k) => [k, (entity as any)[k]])),
      this.metadata.primaryKeys,
    );

    const existing = table.get(pkForLookup);
    if (!existing) {
      throw new MemoryDriverError(
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

    // Version check: if entity has a version field, the stored version must match
    // the previous version (entity has already been incremented by the pipeline)
    const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
    if (versionField) {
      const entityVersion = row[versionField.key] as number;
      const storedVersion = existing[versionField.key] as number;

      // The entity manager increments version before calling update,
      // so entity.version = storedVersion + 1
      if (storedVersion + 1 !== entityVersion) {
        throw new MemoryOptimisticLockError(
          this.metadata.entity.name,
          buildPrimaryKeyDebug(
            entity as Record<string, unknown>,
            this.metadata.primaryKeys,
          ),
        );
      }
    }

    // Merge: start from existing, apply updates (skip PKs, CreateDate, readonly on update)
    const merged = { ...existing };
    for (const field of this.metadata.fields) {
      if (field.computed) continue;
      if (this.metadata.primaryKeys.includes(field.key)) continue;
      if (field.decorator === "CreateDate") continue;
      if (field.decorator === "Field" && field.readonly) continue;

      if (field.key in row) {
        merged[field.key] = row[field.key];
      }
    }

    // Also merge FK values from joinKeys
    for (const relation of this.metadata.relations) {
      if (!relation.joinKeys || relation.type === "ManyToMany") continue;
      for (const [localKey] of Object.entries(relation.joinKeys)) {
        if (localKey in row) {
          merged[localKey] = row[localKey];
        }
      }
    }

    checkUniqueConstraints(table, merged, this.metadata, pkForLookup);

    table.set(pkForLookup, structuredClone(merged));

    return hydrateFromRow<E>(structuredClone(merged), this.metadata, this.amphora);
  }

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", MemoryDriverError);
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const table = this.getTable();
    const toDelete: string[] = [];
    let count = 0;

    // Scope by discriminator for single-table inheritance child entities
    const discPks = this.getDiscriminatorFilteredPks(table);

    for (const [pk, row] of table) {
      if (discPks && !discPks.has(pk)) continue;
      if (matchesRow(row, flatCriteria)) {
        toDelete.push(pk);
        count++;
        if (options?.limit && count >= options.limit) break;
      }
    }

    // Clean up collection table rows before deleting parent rows
    // Note: collection tables are keyed by String(row[parentPkColumn]), NOT by serializePk
    if (toDelete.length > 0 && this.metadata.embeddedLists.length > 0) {
      const store = this.getStore();
      const namespace = this.metadata.entity.namespace ?? null;
      for (const el of this.metadata.embeddedLists) {
        const key = namespace ? `${namespace}.${el.tableName}` : el.tableName;
        const collectionTable = store.collectionTables.get(key);
        if (!collectionTable) continue;
        for (const pk of toDelete) {
          const row = table.get(pk);
          if (row) {
            collectionTable.delete(String(row[el.parentPkColumn]));
          }
        }
      }
    }

    for (const pk of toDelete) {
      table.delete(pk);
    }
  }

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "soft delete", MemoryDriverError);
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const table = this.getTable();
    const dfk = this.deleteFieldKey!;

    // Scope by discriminator for single-table inheritance child entities
    const discPks = this.getDiscriminatorFilteredPks(table);

    for (const [pk, row] of table) {
      if (discPks && !discPks.has(pk)) continue;
      if (matchesRow(row, flatCriteria)) {
        row[dfk] = new Date();
      }
    }
  }

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    guardEmptyCriteria(criteria, "restore", MemoryDriverError);
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const table = this.getTable();
    const dfk = this.deleteFieldKey!;

    // Scope by discriminator for single-table inheritance child entities
    const discPks = this.getDiscriminatorFilteredPks(table);

    for (const [pk, row] of table) {
      if (discPks && !discPks.has(pk)) continue;
      if (matchesRow(row, flatCriteria)) {
        row[dfk] = null;
      }
    }
  }

  public async executeDeleteExpired(): Promise<void> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return;

    const now = Date.now();
    const table = this.getTable();
    const toDelete: string[] = [];

    for (const [pk, row] of table) {
      const expiresAt = row[expiryField.key];
      if (expiresAt == null) continue;

      const expiryDate =
        expiresAt instanceof Date ? expiresAt : new Date(expiresAt as any);
      if (expiryDate.getTime() < now) {
        toDelete.push(pk);
      }
    }

    // Clean up collection table rows before deleting parent rows
    // Note: collection tables are keyed by String(row[parentPkColumn]), NOT by serializePk
    if (toDelete.length > 0 && this.metadata.embeddedLists.length > 0) {
      const store = this.getStore();
      const namespace = this.metadata.entity.namespace ?? null;
      for (const el of this.metadata.embeddedLists) {
        const key = namespace ? `${namespace}.${el.tableName}` : el.tableName;
        const collectionTable = store.collectionTables.get(key);
        if (!collectionTable) continue;
        for (const pk of toDelete) {
          const row = table.get(pk);
          if (row) {
            collectionTable.delete(String(row[el.parentPkColumn]));
          }
        }
      }
    }

    for (const pk of toDelete) {
      table.delete(pk);
    }
  }

  public async executeTtl(criteria: Predicate<E>): Promise<number | null> {
    const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
    if (!expiryField) return null;
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const table = this.getTable();
    for (const [, row] of table) {
      if (matchesRow(row, flatCriteria)) {
        const expiresAt = row[expiryField.key];
        if (expiresAt == null) return null;

        const expiryDate =
          expiresAt instanceof Date ? expiresAt : new Date(expiresAt as any);
        const remainingMs = expiryDate.getTime() - Date.now();
        return Math.max(0, remainingMs);
      }
    }

    return null;
  }

  public async executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    _operationScope?: QueryScope,
  ): Promise<Array<E>> {
    if (options.lock) {
      guardMemoryLockMode(options.lock);
    }

    const table = this.getTable();
    let rows = [...table.values()];

    // Apply version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField && !options.versionTimestamp && !options.withAllVersions) {
      // Only show current version (versionEndDate is null)
      rows = rows.filter((r) => r[versionEndField.key] == null);
    } else if (versionEndField && options.versionTimestamp) {
      // Show version active at the given timestamp
      const ts = options.versionTimestamp.getTime();
      const versionStartField = this.metadata.fields.find(
        (f) => f.decorator === "VersionStartDate",
      );
      rows = rows.filter((r) => {
        const start = r[versionStartField?.key ?? "versionStartDate"];
        const end = r[versionEndField.key];
        const startTime =
          start instanceof Date
            ? start.getTime()
            : start
              ? new Date(start as any).getTime()
              : 0;
        const endTime =
          end == null
            ? Infinity
            : end instanceof Date
              ? end.getTime()
              : new Date(end as any).getTime();
        return startTime <= ts && ts < endTime;
      });
    }

    // Apply predicate filter
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    if (Object.keys(flatCriteria).length > 0) {
      rows = Predicated.filter(rows, flatCriteria);
    }

    // Apply system + user-defined @Filter predicates (includes __softDelete, __scope)
    const filterOverrides = mergeSystemFilterOverrides(
      options.filters,
      options.withDeleted ?? false,
      options.withoutScope ?? false,
    );
    const metaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(metaFilters, this.filterRegistry, filterOverrides);
    rows = applyResolvedFilters(rows, resolved);

    // Apply ordering: explicit FindOptions.order > @DefaultOrder > none
    const effectiveOrder =
      options.order !== undefined
        ? options.order
        : this.metadata.defaultOrder
          ? (this.metadata.defaultOrder as Partial<Record<keyof E, "ASC" | "DESC">>)
          : undefined;
    rows = applyOrdering<E>(rows, effectiveOrder);

    // Apply pagination
    rows = applyPagination(rows, options);

    // Apply select
    const selections = (options.select as Array<string>) ?? null;
    if (selections && selections.length > 0) {
      rows = rows.map((r) => applySelect(r, selections));
    }

    // Hydrate
    return rows.map((row) =>
      hydrateFromRow<E>(
        structuredClone(row),
        this.metadata,
        this.amphora,
        options.snapshot,
      ),
    );
  }

  public async executeCount(
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> {
    const table = this.getTable();
    let rows = [...table.values()];

    // Apply version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField && !options.versionTimestamp && !options.withAllVersions) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    }

    // Apply predicate filter
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    if (Object.keys(flatCriteria).length > 0) {
      rows = Predicated.filter(rows, flatCriteria);
    }

    // Apply system + user-defined @Filter predicates (includes __softDelete, __scope)
    const filterOverrides = mergeSystemFilterOverrides(
      options.filters,
      options.withDeleted ?? false,
      options.withoutScope ?? false,
    );
    const countMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(
      countMetaFilters,
      this.filterRegistry,
      filterOverrides,
    );
    rows = applyResolvedFilters(rows, resolved);

    return rows.length;
  }

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    const table = this.getTable();
    let rows = [...table.values()];

    // Apply version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    }

    // Apply system filters (default-on, includes __softDelete)
    const existsMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(existsMetaFilters, this.filterRegistry, undefined);
    rows = applyResolvedFilters(rows, resolved);

    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    for (const row of rows) {
      if (matchesRow(row, flatCriteria)) return true;
    }

    return false;
  }

  public async executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    const field = this.metadata.fields.find((f) => f.key === (property as string));
    if (field?.encrypted) {
      throw new MemoryDriverError(
        `Cannot increment encrypted field "${String(property)}" on entity "${this.metadata.entity.name}"`,
      );
    }
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const rows = this.getSystemFilteredRows([...this.getTable().values()]);

    for (const row of rows) {
      if (matchesRow(row, flatCriteria)) {
        const current = (row[property as string] as number) ?? 0;
        row[property as string] = current + value;
      }
    }
  }

  public async executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    const field = this.metadata.fields.find((f) => f.key === (property as string));
    if (field?.encrypted) {
      throw new MemoryDriverError(
        `Cannot decrement encrypted field "${String(property)}" on entity "${this.metadata.entity.name}"`,
      );
    }
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const rows = this.getSystemFilteredRows([...this.getTable().values()]);

    for (const row of rows) {
      if (matchesRow(row, flatCriteria)) {
        const current = (row[property as string] as number) ?? 0;
        row[property as string] = current - value;
      }
    }
  }

  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    const results: Array<E> = [];
    for (const entity of entities) {
      results.push(await this.executeInsert(entity));
    }
    return results;
  }

  public async executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
    options?: { systemFilters?: boolean },
  ): Promise<number> {
    const flatCriteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const table = this.getTable();
    const useSystemFilters = options?.systemFilters !== false;

    let rows = [...table.values()];
    if (useSystemFilters) {
      rows = this.getSystemFilteredRows(rows);
    }

    let count = 0;
    for (const row of rows) {
      if (matchesRow(row, flatCriteria)) {
        for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
          const field = this.metadata.fields.find((f) => f.key === key);
          let transformed =
            value != null && field?.transform ? field.transform.to(value) : value;
          if (transformed != null && field?.encrypted && this.amphora) {
            transformed = encryptFieldValue(
              transformed,
              field.encrypted.predicate,
              this.amphora,
              field.key,
              this.metadata.entity.name,
            );
          }
          row[key] = transformed;
        }
        count++;
      }
    }
    return count;
  }

  // ─── Private ─────────────────────────────────────────────────────────

  /**
   * Return the set of PKs from a table whose rows pass the discriminator system filter.
   * Used by delete/softDelete/restore to scope criteria-based operations to the correct
   * discriminator partition in single-table inheritance without excluding soft-deleted rows.
   *
   * Returns null if no discriminator filter is active (optimization: skip filtering).
   */
  private getDiscriminatorFilteredPks(table: MemoryTable): Set<string> | null {
    if (!this.metadata.inheritance?.discriminatorValue) return null;

    const discField = this.metadata.inheritance.discriminatorField;
    const discValue = this.metadata.inheritance.discriminatorValue;

    const pks = new Set<string>();
    for (const [pk, row] of table) {
      if (row[discField] === discValue) {
        pks.add(pk);
      }
    }
    return pks;
  }

  /**
   * Apply default-on system filters (e.g. __softDelete) + version filter to rows.
   * Used by operations that don't take FindOptions (exists, increment, decrement, updateMany).
   * Rows are not cloned — references to Map values are preserved for in-place mutation.
   */
  private getSystemFilteredRows(rows: Array<Dict>): Array<Dict> {
    // Version system filter (not yet migrated to filter infrastructure)
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    }

    // Apply default-on filters (includes __softDelete)
    const sysMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(sysMetaFilters, this.filterRegistry, undefined);
    return applyResolvedFilters(rows, resolved);
  }
}
