import type { DesiredEnumModel } from "./desired-schema-model.js";

/**
 * Pushes a named enum type into the shared schema-model enum list, deduplicated
 * by schema-qualified name in call order (entity fields first, then collection
 * element fields, per entity).
 */
export const addNamedEnum = (
  candidate: DesiredEnumModel | null,
  enums: Array<DesiredEnumModel>,
  enumSet: Set<string>,
): void => {
  if (!candidate) return;
  const key = `${candidate.schema}.${candidate.name}`;
  if (enumSet.has(key)) return;
  enumSet.add(key);
  enums.push(candidate);
};
