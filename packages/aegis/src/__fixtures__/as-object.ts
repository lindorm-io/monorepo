import { isArray, isString } from "@lindorm/is";

/**
 * A raw value as the object it spells: a JOSE value is one already, an
 * interoperable COSE value is a text-keyed map at every depth. A map keyed by a
 * label is not an object and is refused rather than stringified into one.
 */
export const asObject = (value: unknown): unknown => {
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value].map(([key, inner]) => {
        if (isString(key)) return [key, asObject(inner)];

        throw new Error(`a map keyed by the label ${String(key)} is not an object`);
      }),
    );
  }

  return isArray(value) ? value.map(asObject) : value;
};
