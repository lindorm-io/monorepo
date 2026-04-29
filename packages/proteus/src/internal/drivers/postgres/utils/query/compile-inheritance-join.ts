import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type InheritanceAliasMap,
  buildInheritanceAliases as sharedBuildAliases,
  compileInheritanceFrom as sharedCompileFrom,
  compileInheritanceJoin as sharedCompileJoin,
} from "../../../../utils/sql/compile-inheritance-join.js";
import { postgresDialect } from "../postgres-dialect.js";

export type { InheritanceAliasMap };

export const buildInheritanceAliases = (
  metadata: EntityMetadata,
  namespace: string | null,
  startCounter: number,
): { aliases: Array<InheritanceAliasMap>; nextCounter: number } =>
  sharedBuildAliases(metadata, namespace, startCounter, postgresDialect);

export const compileInheritanceJoin = (
  metadata: EntityMetadata,
  inheritanceAliases: Array<InheritanceAliasMap>,
  rootAlias: string,
): string => sharedCompileJoin(metadata, inheritanceAliases, rootAlias, postgresDialect);

export const compileInheritanceFrom = (
  metadata: EntityMetadata,
  inheritanceAliases: Array<InheritanceAliasMap>,
  rootAlias: string,
): { fromClause: string; joinConditions: Array<string> } =>
  sharedCompileFrom(metadata, inheritanceAliases, rootAlias, postgresDialect);
