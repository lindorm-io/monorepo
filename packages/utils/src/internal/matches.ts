import { isArray, isObject } from "@lindorm/is";
import { DeepPartial } from "@lindorm/types";

export const matches = <T>(object: T, predicate: DeepPartial<T>): boolean =>
  Object.entries(predicate).every(([key, predicateValue]) => {
    const objectValue = object[key as keyof T];

    if (isArray(predicateValue)) {
      if (!isArray(objectValue)) return false;

      return predicateValue.every((pv) =>
        objectValue.some((ov) => (isObject(pv) ? matches(ov, pv) : pv === ov)),
      );
    }

    if (isObject(predicateValue)) {
      return matches(objectValue, predicateValue);
    }

    return predicateValue === objectValue;
  });
