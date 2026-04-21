import type { MetaInheritance } from "../types/inheritance.js";
import type { MetaField, MetaFilter } from "../types/metadata.js";

/**
 * System filter name for soft-delete.
 * Double-underscore prefix marks it as internal -- never exposed in FindOptions.filters.
 */
export const SOFT_DELETE_FILTER_NAME = "__softDelete";

/**
 * System filter name for scope fields.
 * When enabled (default), all queries include WHERE conditions for each scope field.
 * Disable per-query via `FindOptions.withoutScope: true`.
 */
export const SCOPE_FILTER_NAME = "__scope";

/**
 * System filter name for single-table inheritance discriminator.
 * When enabled (default), all queries for a child entity include a WHERE condition
 * that filters by the discriminator column value.
 * Root entities do NOT get this filter — querying a root returns all subtypes.
 */
export const DISCRIMINATOR_FILTER_NAME = "__discriminator";

/**
 * Sort scope fields by explicit order (lowest first), then alphabetically by key
 * for fields without an explicit order.
 */
export const sortScopeFields = (scopeFields: Array<MetaField>): Array<MetaField> => {
  const withOrder = scopeFields.filter((f) => f.order != null);
  const withoutOrder = scopeFields.filter((f) => f.order == null);

  withOrder.sort((a, b) => a.order! - b.order!);
  withoutOrder.sort((a, b) => a.key.localeCompare(b.key));

  return [...withOrder, ...withoutOrder];
};

/**
 * Auto-register system filters based on entity field decorators.
 *
 * Currently registers:
 * - `__softDelete`: when the entity has a @DeleteDateField, adds a default-on filter
 *   that excludes rows where the delete-date field is non-null (i.e. soft-deleted rows).
 * - `__scope`: when the entity has @ScopeField(s), adds a default-on filter
 *   with `$paramName` placeholders for each scope field. Params are provided via
 *   `setFilterParams("__scope", { tenantId: "abc", region: "us" })`.
 *
 * Returns an array of MetaFilter entries to be merged into the entity's filter list.
 */
export const generateAutoFilters = (fields: Array<MetaField>): Array<MetaFilter> => {
  const autoFilters: Array<MetaFilter> = [];

  const deleteField = fields.find((f) => f.decorator === "DeleteDate");
  if (deleteField) {
    autoFilters.push({
      name: SOFT_DELETE_FILTER_NAME,
      condition: { [deleteField.key]: null },
      default: true,
    });
  }

  const scopeFields = sortScopeFields(fields.filter((f) => f.decorator === "Scope"));
  if (scopeFields.length > 0) {
    const condition =
      scopeFields.length === 1
        ? { [scopeFields[0].key]: `$${scopeFields[0].key}` }
        : { $and: scopeFields.map((f) => ({ [f.key]: `$${f.key}` })) };

    autoFilters.push({
      name: SCOPE_FILTER_NAME,
      condition,
      default: true,
    });
  }

  return autoFilters;
};

/**
 * Generate a `__discriminator` system filter for child entities in an inheritance hierarchy.
 *
 * When an entity has a non-null `discriminatorValue` (i.e. it is a child entity, not the
 * hierarchy root), a default-on filter is registered that constrains all queries to rows
 * matching that discriminator value. This ensures that querying a child repository only
 * returns rows belonging to that specific subtype.
 *
 * Root entities (discriminatorValue === null) do NOT receive this filter — querying the
 * root returns all subtypes.
 *
 * @returns A single-element array with the discriminator filter, or an empty array.
 */
export const generateDiscriminatorFilter = (
  inheritance: MetaInheritance | null,
): Array<MetaFilter> => {
  if (!inheritance) return [];
  if (inheritance.discriminatorValue == null) return [];

  return [
    {
      name: DISCRIMINATOR_FILTER_NAME,
      condition: { [inheritance.discriminatorField]: inheritance.discriminatorValue },
      default: true,
    },
  ];
};
