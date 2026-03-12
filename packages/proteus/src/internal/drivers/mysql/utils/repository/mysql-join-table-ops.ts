import type { JoinTableOps } from "#internal/types/join-table-ops";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import { syncJoinTableRows, deleteJoinTableRows } from "./manage-join-table";

export const createMysqlJoinTableOps = (client: MysqlQueryClient): JoinTableOps => ({
  sync: (entity, relatedEntities, relation, mirror, namespace) =>
    syncJoinTableRows(entity, relatedEntities, relation, mirror, client, namespace),

  delete: (entity, relation, namespace) =>
    deleteJoinTableRows(entity, relation, client, namespace),
});
