import type { DbSnapshot } from "../../types/db-snapshot.js";
import type { DesiredSchema } from "../../types/desired-schema.js";

export type OrphanedTable = {
  schema: string;
  name: string;
};

export const detectOrphanedTables = (
  snapshot: DbSnapshot,
  desired: DesiredSchema,
): Array<OrphanedTable> => {
  const managedSet = new Set(desired.tables.map((t) => `${t.schema}.${t.name}`));

  return snapshot.tables
    .filter((t) => !managedSet.has(`${t.schema}.${t.name}`))
    .map((t) => ({ schema: t.schema, name: t.name }));
};
