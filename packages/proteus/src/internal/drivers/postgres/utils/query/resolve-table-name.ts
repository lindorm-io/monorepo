import type { EntityMetadata } from "../../../../entity/types/metadata";
import {
  type ResolvedTable,
  buildDiscriminatorPredicate as sharedBuildDiscPredicate,
  resolveTableName as sharedResolveTableName,
} from "../../../../utils/sql/resolve-table-name";
import { postgresDialect } from "../postgres-dialect";

export type { ResolvedTable };

export const resolveTableName = (
  metadata: EntityMetadata,
  namespace?: string | null,
): ResolvedTable => sharedResolveTableName(metadata, postgresDialect, namespace);

export const buildDiscriminatorPredicate = (
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
): string | null =>
  sharedBuildDiscPredicate(metadata, tableAlias, params, postgresDialect);
