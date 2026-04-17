import type { JoinTableOps } from "../../../../types/join-table-ops";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { syncJoinTableRows, deleteJoinTableRows } from "./manage-join-table";

export const createPostgresJoinTableOps = (
  client: PostgresQueryClient,
): JoinTableOps => ({
  sync: (entity, relatedEntities, relation, mirror, namespace) =>
    syncJoinTableRows(entity, relatedEntities, relation, mirror, client, namespace),

  delete: (entity, relation, namespace) =>
    deleteJoinTableRows(entity, relation, client, namespace),
});
