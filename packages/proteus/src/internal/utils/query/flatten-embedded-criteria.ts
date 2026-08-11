import { isObjectLike, isUndefined } from "@lindorm/is";
import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { ProteusError } from "../../../errors/ProteusError.js";

const LOGICAL_OPERATORS = ["$and", "$or", "$not"] as const;

const isPredicateOperator = (value: Dict): boolean =>
  Object.keys(value).some(
    (k) => k.startsWith("$") && !LOGICAL_OPERATORS.includes(k as any),
  );

export const flattenEmbeddedCriteria = <E extends IEntity>(
  criteria: Condition<E>,
  metadata: EntityMetadata,
): Condition<E> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(criteria as Dict)) {
    // Handle logical operators recursively
    if (key === "$and" || key === "$or") {
      result[key] = (value as Array<Condition<E>>).map((sub) =>
        flattenEmbeddedCriteria(sub, metadata),
      );
      continue;
    }
    if (key === "$not") {
      result[key] = flattenEmbeddedCriteria(value as Condition<E>, metadata);
      continue;
    }

    // Check if key is an embedded parent key
    const embeddedChildren = metadata.fields.filter((f) => f.embedded?.parentKey === key);

    if (
      embeddedChildren.length > 0 &&
      isObjectLike(value) &&
      !isPredicateOperator(value as Dict)
    ) {
      // `undefined` means "not supplied", so it is stripped before the shape is
      // read — and a parent key left with nothing under it CONSTRAINS NOTHING.
      // Flattening that emitted no key at all, so `{ address: {} }` evaporated
      // into `{}` and matched every row. Naming a field is a statement that you
      // are constraining it.
      const suppliedChildren = Object.entries(value as Dict).filter(
        ([, childValue]) => !isUndefined(childValue),
      );

      if (suppliedChildren.length === 0) {
        throw new ProteusError(
          `Condition on field "${key}" requires at least one constrained property`,
          {
            code: "invalid_operator_payload",
            title: "Invalid Operator Payload",
            details:
              "An embedded parent key with no constrained property places no restriction. Omit the key, or pass undefined, to place no constraint.",
            data: { field: key },
          },
        );
      }

      // Flatten: { address: { city: "London" } } -> { "address.city": "London" }
      // Preserve child values as-is (scalar, operator object, or null)
      for (const [childKey, childValue] of suppliedChildren) {
        result[`${key}.${childKey}`] = childValue;
      }
      continue;
    }

    result[key] = value;
  }

  return result as Condition<E>;
};
