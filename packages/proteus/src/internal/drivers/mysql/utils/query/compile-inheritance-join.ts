import type { EntityMetadata } from "#internal/entity/types/metadata";
import {
  type InheritanceAliasMap,
  buildInheritanceAliases as sharedBuildAliases,
  compileInheritanceJoin as sharedCompileJoin,
} from "#internal/utils/sql/compile-inheritance-join";
import { mysqlDialect } from "../mysql-dialect";

export type { InheritanceAliasMap };

export const buildInheritanceAliases = (
  metadata: EntityMetadata,
  namespace: string | null,
  startCounter: number,
): { aliases: Array<InheritanceAliasMap>; nextCounter: number } =>
  sharedBuildAliases(metadata, namespace, startCounter, mysqlDialect);

export const compileInheritanceJoin = (
  metadata: EntityMetadata,
  inheritanceAliases: Array<InheritanceAliasMap>,
  rootAlias: string,
): string => sharedCompileJoin(metadata, inheritanceAliases, rootAlias, mysqlDialect);
