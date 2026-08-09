import type { Document } from "mongodb";

/**
 * Read a document key that may address one component of a compound `_id`.
 *
 * A composite primary key resolves to the dotted path `_id.<fieldKey>`, which
 * MongoDB understands in a filter but which is not a property of the returned
 * document — reading it verbatim yields `undefined` for every row and collapses
 * every relation onto one empty key.
 */
export const readDocumentPath = (doc: Document, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, segment) =>
        value == null ? undefined : (value as Record<string, unknown>)[segment],
      doc,
    );

/**
 * Join a document's key values into one comparable string, or `null` when any
 * part is nullish — a join never matches on NULL, so neither does this.
 */
export const documentKey = (doc: Document, paths: Array<string>): string | null => {
  const values: Array<string> = [];
  for (const path of paths) {
    const value = readDocumentPath(doc, path);
    if (value == null) return null;
    values.push(value instanceof Date ? value.toISOString() : String(value));
  }
  return values.join("|");
};

/** The same key, read off a hydrated entity by property key rather than column. */
export const entityKey = (
  entity: unknown,
  keys: Array<string>,
): { key: string; values: Array<unknown> } | null => {
  const values: Array<unknown> = [];
  const parts: Array<string> = [];
  for (const key of keys) {
    const value = (entity as Record<string, unknown>)[key];
    if (value == null) return null;
    values.push(value);
    parts.push(value instanceof Date ? value.toISOString() : String(value));
  }
  return { key: parts.join("|"), values };
};
