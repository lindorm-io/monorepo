export type MigrationInterfaceShape = {
  readonly id: string;
  readonly ts: string;
  readonly driver?: string;
  up: (...args: Array<any>) => Promise<void>;
  down: (...args: Array<any>) => Promise<void>;
};

export type LoadedMigrationShape = {
  migration: MigrationInterfaceShape;
  name: string;
};

export type MigrationRecordShape = {
  id: string;
  name: string;
  checksum: string;
  finishedAt: Date | null;
};

export type ResolvedMigration = {
  migration: MigrationInterfaceShape;
  name: string;
  status: "pending" | "applied" | "checksum_mismatch";
  appliedChecksum: string | null;
};

export type GhostMigration = {
  id: string;
  name: string;
  checksum: string;
  appliedAt: Date | null;
};

export type ResolvePendingResult = {
  resolved: Array<ResolvedMigration>;
  ghosts: Array<GhostMigration>;
};

/**
 * Resolves the status of each loaded migration against applied DB records.
 * Returns `{ resolved, ghosts }` where `resolved` has a status per loaded migration
 * (`"pending"`, `"applied"`, `"checksum_mismatch"`) and `ghosts` lists applied DB
 * records whose source files are missing (deleted or renamed).
 */
export const resolvePending = (
  loaded: Array<LoadedMigrationShape>,
  applied: Array<MigrationRecordShape>,
  computeChecksum: (migration: MigrationInterfaceShape) => string,
): ResolvePendingResult => {
  const appliedMap = new Map(applied.map((r) => [r.id, r]));
  const loadedIds = new Set(loaded.map((l) => l.migration.id));

  const resolved = loaded.map(({ migration, name }) => {
    const record = appliedMap.get(migration.id) ?? null;

    if (!record) {
      return {
        migration,
        name,
        status: "pending" as const,
        appliedChecksum: null,
      };
    }

    const currentChecksum = computeChecksum(migration);
    const checksumMatch = record.checksum === currentChecksum;

    return {
      migration,
      name: record.name,
      status: checksumMatch ? ("applied" as const) : ("checksum_mismatch" as const),
      appliedChecksum: record.checksum,
    };
  });

  const ghosts: Array<GhostMigration> = applied
    .filter((record) => !loadedIds.has(record.id))
    .map((record) => ({
      id: record.id,
      name: record.name,
      checksum: record.checksum,
      appliedAt: record.finishedAt,
    }));

  return { resolved, ghosts };
};
