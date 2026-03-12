import type { Document } from "mongodb";
import type { Dict } from "@lindorm/types";

/**
 * Deep-clone a MongoDB document to a plain JS object, stripping
 * internal getters from the MongoDB driver v6 (lazy BSON deserialization).
 *
 * This must be called before any hydration or deep-equal comparison,
 * because driver getters break Object.keys(), spread, and deepEqual.
 */
export const cloneDocument = (doc: Document): Dict => {
  return structuredClone(doc);
};
