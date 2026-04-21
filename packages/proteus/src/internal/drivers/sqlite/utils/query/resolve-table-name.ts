import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type ResolvedTable,
  buildDiscriminatorPredicate as sharedBuildDiscPredicate,
  resolveTableName as sharedResolveTableName,
} from "../../../../utils/sql/resolve-table-name.js";
import { sqliteDialect } from "../sqlite-dialect.js";

export type { ResolvedTable };

export const resolveTableName = (
  metadata: EntityMetadata,
  _namespace?: string | null,
): ResolvedTable => sharedResolveTableName(metadata, sqliteDialect, _namespace);

export const buildDiscriminatorPredicate = (
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
): string | null => sharedBuildDiscPredicate(metadata, tableAlias, params, sqliteDialect);
