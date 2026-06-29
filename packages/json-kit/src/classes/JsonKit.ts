import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { Primitive } from "./Primitive.js";

/**
 * The two halves of a losslessly-encoded value, separated so they can be stored
 * independently (e.g. `data` in a queryable jsonb column, `meta` in a sidecar
 * type-metadata column).
 *
 * - `data` is a plain JSON-safe structure (Date → ISO string, BigInt → string,
 *   Buffer → base64, …) — safe to `JSON.stringify` and query with `->`/`->>`.
 * - `meta` records the original type of each path so `join` can restore them.
 */
export type JsonKitSplit = {
  data: Array<any> | Dict;
  meta: Array<any> | Dict;
};

export class JsonKit {
  static buffer<T extends Array<any> | Dict = Dict>(input: T): Buffer {
    return new Primitive(input).toBuffer();
  }

  static parse<T extends Array<any> | Dict = Dict>(input: any): T {
    return new Primitive<T>(input).toJSON();
  }

  /**
   * Split a value into its JSON-safe `data` and its type `meta`, so the two can
   * be persisted in separate columns. Reconstruct with {@link JsonKit.join}.
   */
  static split<T extends Array<any> | Dict = Dict>(input: T): JsonKitSplit {
    const primitive = new Primitive(input);
    return { data: primitive.data, meta: primitive.meta };
  }

  /**
   * Reconstruct a value from a previously-split `data` + `meta` (see
   * {@link JsonKit.split}), restoring Date/Buffer/BigInt/undefined.
   */
  static join<T extends Array<any> | Dict = Dict>(
    data: Array<any> | Dict,
    meta: Array<any> | Dict,
  ): T {
    const key = isArray(data) ? "__array__" : "__record__";
    return new Primitive<T>({ __meta__: meta, [key]: data }).toJSON();
  }

  static primitive<T extends Array<any> | Dict = Dict>(input: any): Primitive<T> {
    return new Primitive(input);
  }

  static stringify<T extends Array<any> | Dict = Dict>(input: T): string {
    return new Primitive(input).toString();
  }
}
