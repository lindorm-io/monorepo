import { isBigInt, isDate } from "@lindorm/is";
import { ProteusError } from "../../../errors/index.js";
import type { EntityMetadata } from "../types/metadata.js";

const JSON_FIELD_TYPES = new Set(["json", "object", "array"]);

type Offence = { type: string; path: string };

/**
 * Recursively find the first value that does not survive a plain JSON
 * round-trip with fidelity — a `Date` (→ ISO string), `Buffer`/`Uint8Array`
 * (→ `{type,data}`), `BigInt` (→ throws), `Map`/`Set` (→ `{}`). Plain objects
 * and arrays are walked; primitives, `null`, `undefined`, functions and symbols
 * are fine (standard JSON behaviour). Returns the offending type + its path.
 */
const findUnserialisable = (value: unknown, path: string): Offence | null => {
  if (value == null) return null;
  if (isDate(value)) return { type: "Date", path };
  if (isBigInt(value)) return { type: "BigInt", path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { type: "Buffer", path };
  }
  if (value instanceof Map) return { type: "Map", path };
  if (value instanceof Set) return { type: "Set", path };

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const offence = findUnserialisable(value[i], `${path}[${i}]`);
      if (offence) return offence;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const offence = findUnserialisable(child, path ? `${path}.${key}` : key);
      if (offence) return offence;
    }
  }

  return null;
};

/**
 * Guard plain (non-`@TypedJson`) json/object/array fields against complex JS
 * types that silently corrupt under JSON storage. `@TypedJson` fields are
 * skipped — they round-trip losslessly via their sidecar type-metadata column.
 * Throws a clear error pointing at `@TypedJson`.
 */
export const assertSerialisableJsonFields = <E>(
  metadata: EntityMetadata,
  entity: E,
): void => {
  for (const field of metadata.fields) {
    if (field.typedJson) continue;
    if (field.embedded) continue;
    if (!field.type || !JSON_FIELD_TYPES.has(field.type)) continue;

    const value = (entity as any)[field.key];
    if (value == null) continue;

    const offence = findUnserialisable(value, field.key);
    if (!offence) continue;

    throw new ProteusError(
      `Cannot store a ${offence.type} in the plain json field "${field.key}" (at "${offence.path}")`,
      {
        code: "unserialisable_json",
        title: "Unserialisable JSON",
        details: `Field "${field.key}" (at "${offence.path}") holds a ${offence.type}, which does not survive plain JSON serialisation and would be silently corrupted. Add @TypedJson() to "${field.key}" for lossless storage, or convert the value to a JSON-native type before writing.`,
        data: { field: field.key, type: offence.type, path: offence.path },
      },
    );
  }
};
