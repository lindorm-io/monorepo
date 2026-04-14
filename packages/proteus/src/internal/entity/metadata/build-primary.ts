import type { Constructor, Dict } from "@lindorm/types";
import { snakeCase } from "@lindorm/case";
import { uniq } from "@lindorm/utils";
import { EntityMetadataError } from "../errors/EntityMetadataError";
import { IEntity } from "../../../interfaces";
import type {
  EmbeddedListLoadingScope,
  EntityMetadata,
  MetaCache,
  MetaEmbeddedList,
  MetaExtra,
  MetaField,
  MetaFieldDecorator,
} from "../types/metadata";
import type { MetaInheritance } from "../types/inheritance";
import type {
  StagedEmbedded,
  StagedEmbeddedList,
  StagedFieldModifier,
  StagedRelationModifier,
} from "../types/staged";
import {
  generateAutoFilters,
  generateDiscriminatorFilter,
  sortScopeFields,
} from "./auto-filters";
import { generateAutoIndexes } from "./auto-indexes";
import { collectAll, collectOwn, collectSingular } from "./collect";
import { inferGeneratedTypes } from "./infer-generated-type";
import { validateEmbeddedListInitializers } from "./validate-embedded-list-initializers";
import { validateFields } from "./validate-fields";
import { validateIndexes } from "./validate-indexes";
import { validatePrimaryKeys, validateVersionKeys } from "./validate-primary-keys";
import { validateFilters } from "./validate-filters";
import { validateUniques } from "./validate-uniques";

const primaryCache = new Map<Function, Omit<EntityMetadata, "relations">>();

/** Clear the primary metadata cache. Call before inheritance resolution to
 *  ensure any metadata cached before setup() is invalidated and rebuilt. */
export const clearPrimaryCache = (): void => {
  primaryCache.clear();
};

/**
 * Merge field modifiers into their corresponding fields by property key.
 * Throws if a modifier targets a property with no @Field decorator.
 * Throws on duplicate modifier decorators for the same property (except @Hide which is additive).
 */
const mergeFieldModifiers = <TDecorator extends MetaFieldDecorator>(
  targetName: string,
  fields: Array<MetaField<TDecorator>>,
  modifiers: Array<StagedFieldModifier>,
): void => {
  // Track which modifier types have been applied per property
  const applied = new Map<string, Set<string>>();

  for (const modifier of modifiers) {
    const field = fields.find((f) => f.key === modifier.key);

    if (!field) {
      throw new EntityMetadataError(
        `@${modifier.decorator} on property "${modifier.key}" requires a @Field decorator`,
        {
          debug: {
            target: targetName,
            property: modifier.key,
            decorator: modifier.decorator,
          },
        },
      );
    }

    // Duplicate modifier detection (except Hide which is additive)
    if (modifier.decorator !== "Hide") {
      let propSet = applied.get(modifier.key);
      if (!propSet) {
        propSet = new Set();
        applied.set(modifier.key, propSet);
      }
      if (propSet.has(modifier.decorator)) {
        throw new EntityMetadataError(
          `Duplicate @${modifier.decorator} on property "${modifier.key}"`,
          { debug: { target: targetName, property: modifier.key } },
        );
      }
      propSet.add(modifier.decorator);
    }

    // Apply modifier values
    if (modifier.nullable != null) field.nullable = modifier.nullable;
    if (modifier.default !== undefined) field.default = modifier.default;
    if (modifier.readonly != null) field.readonly = modifier.readonly;
    if (modifier.min != null) field.min = modifier.min;
    if (modifier.max != null) field.max = modifier.max;
    if (modifier.precision != null) field.precision = modifier.precision;
    if (modifier.scale != null) field.scale = modifier.scale;
    if (modifier.enum != null) field.enum = modifier.enum;
    if (modifier.computed != null) {
      field.computed = modifier.computed;
      field.readonly = true; // @Computed auto-sets ReadOnly
    }
    if (modifier.transform != null) field.transform = modifier.transform;
    if (modifier.encrypted != null)
      field.encrypted = { predicate: modifier.encrypted.predicate };
    if (modifier.hideOn != null) {
      // Hide is additive — merge arrays
      field.hideOn = uniq([...field.hideOn, ...modifier.hideOn]);
    }
    if (modifier.comment != null) field.comment = modifier.comment;
    if (modifier.schema != null) field.schema = modifier.schema;
  }
};

/**
 * Flatten @Embedded fields into the parent entity's field array.
 *
 * For each @Embedded declaration:
 * 1. Resolve the embeddable constructor via the thunk
 * 2. Verify it has __embeddable: true on its Symbol.metadata
 * 3. Collect fields from the embeddable class's Symbol.metadata
 * 4. Also collect field modifiers from the embeddable and merge them
 * 5. Create new MetaField entries with dotted keys and prefixed column names
 * 6. Validate no duplicate column names after flattening
 */
const flattenEmbeddedFields = <TDecorator extends MetaFieldDecorator>(
  targetName: string,
  fields: Array<MetaField<TDecorator>>,
  embeddeds: Array<StagedEmbedded>,
): void => {
  for (const embedded of embeddeds) {
    const EmbeddableClass = embedded.embeddableConstructor();
    const embeddableMeta = EmbeddableClass[Symbol.metadata];

    if (!embeddableMeta || !embeddableMeta.__embeddable) {
      throw new EntityMetadataError(
        `@Embedded property "${embedded.key}" references class "${EmbeddableClass?.name ?? "(unknown)"}" which is not decorated with @Embeddable()`,
        { debug: { target: targetName, property: embedded.key } },
      );
    }

    // Collect fields from the embeddable class
    const embeddableFields = collectAll(EmbeddableClass, "fields").map((f) => ({
      ...f,
    })) as Array<MetaField<TDecorator>>;

    // Also merge field modifiers from the embeddable
    const embeddableModifiers = collectAll(EmbeddableClass, "fieldModifiers");
    if (embeddableModifiers.length > 0) {
      mergeFieldModifiers(EmbeddableClass.name, embeddableFields, embeddableModifiers);
    }

    // Guard: nested @Embeddable within @Embeddable is not supported.
    // Both hydrate and dehydrate use split(".")[1] for two-level nesting only.
    const nestedEmbeddeds = collectAll(EmbeddableClass, "embeddeds");
    if (nestedEmbeddeds.length > 0) {
      throw new EntityMetadataError(
        `@Embedded property "${embedded.key}" references class "${EmbeddableClass.name}" which contains nested @Embedded fields. Nested embeddables are not supported — use a flat @Embeddable class or inline the fields directly.`,
        {
          debug: {
            target: targetName,
            property: embedded.key,
            nestedEmbeddeds: nestedEmbeddeds.map((e) => e.key),
          },
        },
      );
    }

    // Create flattened fields with dotted keys and prefixed column names.
    // Child fields preserve their original nullable state from the @Embeddable class.
    // The parent wrapper is nullish (handled by Zod validation) — when the embedded
    // object is null, child validation is skipped entirely. When the embedded object
    // IS present, child fields enforce their original constraints.
    for (const ef of embeddableFields) {
      fields.push({
        ...ef,
        key: `${embedded.key}.${ef.key}`,
        name: `${embedded.prefix}${ef.name}`,
        embedded: {
          parentKey: embedded.key,
          constructor: embedded.embeddableConstructor,
        },
      } as MetaField<TDecorator>);
    }
  }

  // Validate no duplicate column names after flattening
  const seen = new Map<string, string>();
  for (const field of fields) {
    const existing = seen.get(field.name);
    if (existing) {
      throw new EntityMetadataError(
        `Duplicate column name "${field.name}" — field "${field.key}" collides with "${existing}"`,
        {
          debug: {
            target: targetName,
            field1: existing,
            field2: field.key,
            column: field.name,
          },
        },
      );
    }
    seen.set(field.name, field.key);
  }
};

/**
 * Resolve @EmbeddedList declarations into MetaEmbeddedList entries.
 *
 * For each staged embedded list:
 * 1. Determine table name (explicit or auto-generated from entity + field key)
 * 2. Determine parent FK column from the entity's primary key
 * 3. For embeddable element types: resolve fields from the embeddable class
 * 4. For primitive element types: single "value" column
 */
const DEFAULT_EMBEDDED_LIST_LOADING: EmbeddedListLoadingScope = {
  single: "eager",
  multiple: "lazy",
};

const resolveEmbeddedListLoading = (
  targetName: string,
  key: string,
  modifiers: Array<StagedRelationModifier>,
): EmbeddedListLoadingScope => {
  const loading: EmbeddedListLoadingScope = { ...DEFAULT_EMBEDDED_LIST_LOADING };

  // Track applied scopes for conflict detection
  const applied = new Map<string, string>(); // scopeKey → decoratorName

  for (const modifier of modifiers) {
    if (modifier.key !== key) continue;

    // Embedded lists only support @Eager / @Lazy — other modifier kinds
    // (cascade, onOrphan, deferrable, orderBy) are relation-only and will
    // be caught by mergeRelationModifiers throwing below.
    const hasNonLoading =
      modifier.cascade != null ||
      modifier.deferrable != null ||
      modifier.initiallyDeferred != null ||
      modifier.onOrphan != null ||
      modifier.orderBy != null;
    if (hasNonLoading) {
      throw new EntityMetadataError(
        `@${modifier.decorator} on property "${key}" is not valid on @EmbeddedList — only @Eager and @Lazy are supported`,
        { debug: { target: targetName, property: key } },
      );
    }

    if (!modifier.loading || modifier.loading === "ignore") continue;

    const loadingValue: "eager" | "lazy" = modifier.loading;
    const scopeKey = modifier.loadingScope ?? "both";
    const baseName = loadingValue === "eager" ? "Eager" : "Lazy";
    const opposite = baseName === "Eager" ? "Lazy" : "Eager";

    // Duplicate detection (same decorator with same scope)
    for (const [scope, dec] of applied) {
      if (scope === scopeKey && dec === modifier.decorator) {
        throw new EntityMetadataError(
          `Duplicate @${modifier.decorator} on property "${key}" of ${targetName}`,
          {
            debug: { target: targetName, property: key, decorator: modifier.decorator },
          },
        );
      }
    }

    // Conflict detection: Eager vs Lazy on overlapping scopes
    const scopesToCheck =
      scopeKey === "both" ? ["both", "single", "multiple"] : ["both", scopeKey];
    for (const checkScope of scopesToCheck) {
      const existing = applied.get(checkScope);
      if (existing && existing.startsWith(opposite)) {
        throw new EntityMetadataError(
          `@Eager and @Lazy conflict on property "${key}" of ${targetName} (overlapping scope)`,
          { debug: { target: targetName, property: key } },
        );
      }
    }

    applied.set(scopeKey, modifier.decorator);

    if (modifier.loadingScope) {
      loading[modifier.loadingScope] = loadingValue;
    } else {
      loading.single = loadingValue;
      loading.multiple = loadingValue;
    }
  }

  return loading;
};

const resolveEmbeddedLists = (
  targetName: string,
  entityName: string,
  staged: Array<StagedEmbeddedList>,
  primaryKeys: Array<string>,
  fields: Array<MetaField>,
  relationModifiers: Array<StagedRelationModifier>,
): Array<MetaEmbeddedList> => {
  if (primaryKeys.length !== 1) {
    throw new EntityMetadataError(
      `@EmbeddedList requires a single primary key, but "${targetName}" has ${primaryKeys.length}`,
      { debug: { target: targetName, primaryKeys } },
    );
  }

  const parentPkColumn = primaryKeys[0];
  const pkField = fields.find((f) => f.key === parentPkColumn);
  const pkColumnName = pkField?.name ?? parentPkColumn;
  const parentFkColumn = `${snakeCase(entityName)}_${pkColumnName}`;

  const result: Array<MetaEmbeddedList> = [];

  for (const entry of staged) {
    const tableName =
      entry.tableName ?? `${snakeCase(entityName)}_${snakeCase(entry.key)}`;

    const loading = resolveEmbeddedListLoading(targetName, entry.key, relationModifiers);

    if (entry.elementConstructor) {
      // Embeddable element type
      const EmbeddableClass = entry.elementConstructor();
      const embeddableMeta = EmbeddableClass[Symbol.metadata];

      if (!embeddableMeta || !embeddableMeta.__embeddable) {
        throw new EntityMetadataError(
          `@EmbeddedList property "${entry.key}" references class "${EmbeddableClass?.name ?? "(unknown)"}" which is not decorated with @Embeddable()`,
          { debug: { target: targetName, property: entry.key } },
        );
      }

      const embeddableFields = collectAll(EmbeddableClass, "fields").map((f) => ({
        ...f,
      }));

      // Merge field modifiers from the embeddable
      const embeddableModifiers = collectAll(EmbeddableClass, "fieldModifiers");
      if (embeddableModifiers.length > 0) {
        mergeFieldModifiers(EmbeddableClass.name, embeddableFields, embeddableModifiers);
      }

      validateFields(EmbeddableClass.name, embeddableFields);

      result.push({
        key: entry.key,
        tableName,
        parentFkColumn,
        parentPkColumn,
        elementType: null,
        elementFields: embeddableFields,
        elementConstructor: entry.elementConstructor as () => Constructor,
        loading,
      });
    } else {
      // Reject structured types — they cannot be serialized into a single column
      const rejectedTypes = ["object", "json", "array"];
      if (entry.elementType && rejectedTypes.includes(entry.elementType)) {
        throw new EntityMetadataError(
          `@EmbeddedList property "${entry.key}" uses element type "${entry.elementType}" which is not supported. Use an @Embeddable class for structured elements, or a primitive type (string, integer, etc.) for scalar elements.`,
          {
            debug: {
              target: targetName,
              property: entry.key,
              elementType: entry.elementType,
            },
          },
        );
      }

      // Primitive element type
      result.push({
        key: entry.key,
        tableName,
        parentFkColumn,
        parentPkColumn,
        elementType: entry.elementType,
        elementFields: null,
        elementConstructor: null,
        loading,
      });
    }
  }

  // Validate no duplicate collection table names
  const seenTableNames = new Set<string>();
  for (const el of result) {
    if (seenTableNames.has(el.tableName)) {
      throw new EntityMetadataError(
        `Duplicate collection table name "${el.tableName}" — two @EmbeddedList fields resolve to the same table`,
        { debug: { target: targetName, tableName: el.tableName } },
      );
    }
    seenTableNames.add(el.tableName);
  }

  return result;
};

/**
 * For single-table inheritance roots, merge fields from all subtype entities
 * into the root's field array. Subtype-specific fields (those not already on
 * the root) are forced nullable because a row for one subtype will not populate
 * columns that belong to a different subtype.
 */
const mergeSingleTableSubtypeFields = <TDecorator extends MetaFieldDecorator>(
  _rootTarget: Function,
  rootFields: Array<MetaField<TDecorator>>,
  inheritance: MetaInheritance,
): void => {
  const rootFieldKeys = new Set(rootFields.map((f) => f.key));

  for (const [, childConstructor] of inheritance.children) {
    const childFields = collectAll(childConstructor, "fields").map((f) => ({
      ...f,
    })) as Array<MetaField<TDecorator>>;

    // Also merge field modifiers for child fields
    const childModifiers = collectAll(childConstructor, "fieldModifiers");
    if (childModifiers.length > 0) {
      mergeFieldModifiers(childConstructor.name, childFields, childModifiers);
    }

    // Flatten child @Embedded fields
    const childEmbeddeds = collectAll(childConstructor, "embeddeds");
    if (childEmbeddeds.length > 0) {
      flattenEmbeddedFields(childConstructor.name, childFields, childEmbeddeds);
    }

    for (const childField of childFields) {
      if (rootFieldKeys.has(childField.key)) continue; // Already on root — skip

      // Force nullable for subtype-specific fields
      rootFields.push({
        ...childField,
        nullable: true,
      });
      rootFieldKeys.add(childField.key);
    }
  }
};

export type BuildPrimaryOptions = {
  inheritance?: MetaInheritance;
};

export const buildPrimaryMetadata = <
  TExtra extends Dict = Dict,
  TDecorator extends MetaFieldDecorator = MetaFieldDecorator,
>(
  target: Function,
  options?: BuildPrimaryOptions,
): Omit<EntityMetadata<TExtra, TDecorator>, "relations"> => {
  const cached = primaryCache.get(target) as
    | Omit<EntityMetadata<TExtra, TDecorator>, "relations">
    | undefined;

  if (cached) return cached;

  // Guard: abstract entities cannot be built directly
  // Use collectOwn — only the target's own metadata, not inherited from parent
  const isAbstract = collectOwn(target, "__abstract");
  const entity = collectOwn(target, "entity");

  if (isAbstract && entity) {
    throw new EntityMetadataError(
      "@AbstractEntity and @Entity cannot be used on the same class",
      { debug: { target: target.name } },
    );
  }

  if (isAbstract && !collectOwn(target, "__inheritance")) {
    throw new EntityMetadataError(
      "Cannot build metadata for abstract entity — use a concrete @Entity() subclass",
      { debug: { target: target.name } },
    );
  }

  if (!entity) {
    throw new EntityMetadataError("Entity metadata not found", {
      debug: { target: target.name },
    });
  }

  // Merge namespace from @Namespace() decorator into entity metadata
  const namespace = collectSingular(target, "namespace");
  if (namespace) {
    entity.namespace = namespace;
  }

  const appendOnly = collectSingular(target, "__appendOnly") === true;

  // Guard: @AppendOnly contradicts @DeleteDateField and @ExpiryDateField
  if (appendOnly) {
    const allFields = collectAll(target, "fields");
    if (allFields.some((f) => f.decorator === "DeleteDate")) {
      throw new EntityMetadataError(
        "@AppendOnly and @DeleteDateField are contradictory — append-only entities cannot be soft-deleted",
        { debug: { target: target.name } },
      );
    }
    if (allFields.some((f) => f.decorator === "ExpiryDate")) {
      throw new EntityMetadataError(
        "@AppendOnly and @ExpiryDateField are contradictory — append-only entities cannot expire",
        { debug: { target: target.name } },
      );
    }
  }

  const stagedCache = collectSingular(target, "cache");
  const cache: MetaCache | null = stagedCache ? { ttlMs: stagedCache.ttlMs } : null;

  const defaultOrder = collectSingular(target, "defaultOrder") ?? null;

  const checks = collectAll(target, "checks");
  const fields = collectAll(target, "fields").map((f) => ({ ...f })) as Array<
    MetaField<TDecorator>
  >;
  const fieldModifiers = collectAll(target, "fieldModifiers");
  const filters = collectAll(target, "filters");
  const hooks = collectAll(target, "hooks");
  const extras = collectAll(target, "extras") as Array<MetaExtra<TExtra>>;
  const generated = collectAll(target, "generated");
  const indexes = collectAll(target, "indexes");
  const primaryK = collectAll(target, "primaryKeys");
  const relationIds = collectAll(target, "relationIds");
  const relationCounts = collectAll(target, "relationCounts");
  const schemas = collectAll(target, "schemas");
  const uniques = collectAll(target, "uniques");
  const versionK = collectAll(target, "versionKeys");

  // Merge field modifiers into fields before validation
  if (fieldModifiers.length > 0) {
    mergeFieldModifiers(target.name, fields, fieldModifiers);
  }

  // Flatten @Embedded fields into parent's field array
  const embeddeds = collectAll(target, "embeddeds");
  if (embeddeds.length > 0) {
    flattenEmbeddedFields(target.name, fields, embeddeds);
  }

  // For single-table inheritance roots, merge subtype fields into root
  const inheritance = options?.inheritance ?? null;
  if (
    inheritance &&
    inheritance.strategy === "single-table" &&
    inheritance.parent === null &&
    inheritance.children.size > 0
  ) {
    mergeSingleTableSubtypeFields(target, fields, inheritance);
  }

  validateFields(target.name, fields);

  const primaryKeys = primaryK.map((pk) => pk.key);
  validatePrimaryKeys(target.name, primaryKeys, fields);

  // Guard: embedded fields cannot be primary keys
  for (const pk of primaryKeys) {
    if (pk.includes(".")) {
      throw new EntityMetadataError(`Embedded field "${pk}" cannot be a primary key`, {
        debug: { target: target.name, primaryKey: pk },
      });
    }
  }

  const versionKeys = versionK.map((vk) => vk.key);
  validateVersionKeys(target.name, versionKeys, primaryKeys, fields);

  // Auto-indexes anchor on a single stable (non-version) PK column.
  // Composite PKs with no single stable anchor are domain-specific — skip.
  const stableKeys = primaryKeys.filter((k) => !versionKeys.includes(k));
  if (stableKeys.length === 1) {
    indexes.push(...generateAutoIndexes(stableKeys[0], fields, versionKeys));
  }

  validateIndexes(target.name, indexes, fields);
  validateUniques(target.name, uniques, fields);

  // Compute ordered scope field keys (for driver-level key composition)
  const scopeKeys = sortScopeFields(fields.filter((f) => f.decorator === "Scope")).map(
    (f) => f.key,
  );

  // Auto-register system filters (e.g. __softDelete for @DeleteDateField, __scope for @ScopeField)
  filters.push(...generateAutoFilters(fields));

  // Auto-register __discriminator filter for child entities in inheritance hierarchies
  filters.push(...generateDiscriminatorFilter(inheritance));

  validateFilters(target.name, filters, fields);
  inferGeneratedTypes(target.name, generated, fields);

  // Resolve @EmbeddedList declarations
  const stagedEmbeddedLists = collectAll(target, "embeddedLists");
  const stagedRelationModifiers = collectAll(target, "relationModifiers");
  const embeddedLists =
    stagedEmbeddedLists.length > 0
      ? resolveEmbeddedLists(
          target.name,
          entity.name,
          stagedEmbeddedLists,
          primaryKeys,
          fields,
          stagedRelationModifiers,
        )
      : [];

  // Guard: @EmbeddedList property keys must not collide with @Field property keys
  for (const el of embeddedLists) {
    if (fields.some((f) => f.key === el.key)) {
      throw new EntityMetadataError(
        `Property "${el.key}" is declared as both @Field and @EmbeddedList — use one or the other`,
        { debug: { target: target.name, property: el.key } },
      );
    }
  }

  // Guard: lazy-scope @EmbeddedList fields must not carry class field initializers.
  // Field initializers run in `new target()` before hydrate and pre-populate the
  // property with `[]`, which causes `installLazyEmbeddedLists` to skip the field
  // (it only overwrites `undefined`) and the lazy loader never fires.
  validateEmbeddedListInitializers(target.name, target, embeddedLists);

  const final: Omit<EntityMetadata<TExtra, TDecorator>, "relations"> = {
    target: target as Constructor<IEntity>,
    appendOnly,
    cache,
    checks,
    defaultOrder,
    embeddedLists,
    entity,
    extras,
    fields,
    filters,
    generated,
    hooks,
    inheritance,
    indexes,
    primaryKeys,
    relationIds,
    relationCounts,
    schemas,
    scopeKeys,
    uniques,
    versionKeys,
  };

  primaryCache.set(target, final);

  return final;
};
