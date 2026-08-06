import { isArray, isNull, isObject, isString, isUndefined } from "@lindorm/is";

/**
 * `application/x-www-form-urlencoded` is a flat list of name/value pairs, so a
 * structured value has to be flattened DELIBERATELY — `URLSearchParams` would
 * otherwise stringify an object to `[object Object]` and join an array on
 * commas, both of which are silently wrong on the wire.
 *
 * - a list of primitives becomes REPEATED parameters — RFC 8693 §2.1 relies on
 *   that for multi-valued `audience` / `resource`
 * - anything else structured (an object, or a list holding one) becomes ONE
 *   parameter carrying its JSON — RFC 9396 §2 relies on that for
 *   `authorization_details`
 * - `undefined` and `null` are omitted; remaining primitives are stringified
 */
export const composeUrlEncoded = (
  entries: Iterable<[string, unknown]>,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of entries) {
    if (isUndefined(value) || isNull(value)) continue;

    if (isString(value)) {
      params.append(key, value);
      continue;
    }

    if (isArray<unknown>(value)) {
      if (value.some((entry) => isObject(entry) || isArray(entry))) {
        params.append(key, JSON.stringify(value));
        continue;
      }

      for (const entry of value) {
        if (isUndefined(entry) || isNull(entry)) continue;

        params.append(key, isString(entry) ? entry : String(entry));
      }

      continue;
    }

    if (isObject(value)) {
      params.append(key, JSON.stringify(value));
      continue;
    }

    params.append(key, String(value));
  }

  return params;
};
