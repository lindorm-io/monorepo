import type { Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

const LOGICAL_OPERATORS = ["$and", "$or", "$not"] as const;

const isPredicateOperator = (value: Dict): boolean =>
  Object.keys(value).some(
    (k) => k.startsWith("$") && !LOGICAL_OPERATORS.includes(k as any),
  );

export const flattenEmbeddedCriteria = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
): Predicate<E> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(criteria as Dict)) {
    // Handle logical operators recursively
    if (key === "$and" || key === "$or") {
      result[key] = (value as Array<Predicate<E>>).map((sub) =>
        flattenEmbeddedCriteria(sub, metadata),
      );
      continue;
    }
    if (key === "$not") {
      result[key] = flattenEmbeddedCriteria(value as Predicate<E>, metadata);
      continue;
    }

    // Check if key is an embedded parent key
    const embeddedChildren = metadata.fields.filter((f) => f.embedded?.parentKey === key);

    if (
      embeddedChildren.length > 0 &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !isPredicateOperator(value as Dict)
    ) {
      // Flatten: { address: { city: "London" } } -> { "address.city": "London" }
      // Preserve child values as-is (scalar, operator object, or null)
      for (const [childKey, childValue] of Object.entries(value as Dict)) {
        result[`${key}.${childKey}`] = childValue;
      }
      continue;
    }

    result[key] = value;
  }

  return result as Predicate<E>;
};
