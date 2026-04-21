import type { JoinTableOps } from "../../../../types/join-table-ops.js";
import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import { syncJoinTableRows, deleteJoinTableRows } from "./manage-join-table.js";

export const createSqliteJoinTableOps = (client: SqliteQueryClient): JoinTableOps => ({
  sync: (entity, relatedEntities, relation, mirror, namespace) =>
    syncJoinTableRows(entity, relatedEntities, relation, mirror, client, namespace),

  delete: (entity, relation, namespace) =>
    deleteJoinTableRows(entity, relation, client, namespace),
});
