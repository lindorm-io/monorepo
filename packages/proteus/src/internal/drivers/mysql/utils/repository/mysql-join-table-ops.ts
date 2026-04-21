import type { JoinTableOps } from "../../../../types/join-table-ops.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { syncJoinTableRows, deleteJoinTableRows } from "./manage-join-table.js";

export const createMysqlJoinTableOps = (client: MysqlQueryClient): JoinTableOps => ({
  sync: (entity, relatedEntities, relation, mirror, namespace) =>
    syncJoinTableRows(entity, relatedEntities, relation, mirror, client, namespace),

  delete: (entity, relation, namespace) =>
    deleteJoinTableRows(entity, relation, client, namespace),
});
