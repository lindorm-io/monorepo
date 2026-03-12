export type SerializedPk = string;
export type MemoryTable = Map<SerializedPk, Record<string, unknown>>;

/**
 * Collection tables store embedded list rows keyed by parent FK value.
 * Each entry is an array of row dicts (no PK, no Map key needed).
 */
export type MemoryCollectionTable = Map<string, Array<Record<string, unknown>>>;

export type MemoryStore = {
  tables: Map<string, MemoryTable>;
  joinTables: Map<string, MemoryTable>;
  collectionTables: Map<string, MemoryCollectionTable>;
  incrementCounters: Map<string, number>;
};

export type MemoryTransactionHandle = {
  store: MemoryStore;
  state: "active" | "committed" | "rolledBack";
  savepointStack: Array<MemoryStore>;
};
