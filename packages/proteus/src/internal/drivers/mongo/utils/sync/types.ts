/**
 * Represents an existing MongoDB index as introspected from the database.
 */
export type ExistingMongoIndex = {
  collection: string;
  name: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  sparse: boolean;
  expireAfterSeconds: number | null;
};

/**
 * Represents a desired MongoDB index projected from entity metadata.
 */
export type DesiredMongoIndex = {
  collection: string;
  name: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  sparse: boolean;
  expireAfterSeconds: number | null;
};

/**
 * The sync plan produced by diffing existing vs desired indexes.
 */
export type MongoSyncPlan = {
  collectionsToCreate: Array<string>;
  indexesToCreate: Array<DesiredMongoIndex>;
  indexesToDrop: Array<{ collection: string; name: string }>;
};
