import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec, RawSelectEntry, WindowSpec } from "../../../../types/query.js";
import type {
  AliasMap,
  BuiltAliasResult,
  InheritanceAliasMap,
} from "../../../../utils/sql/types.js";
import {
  buildAliasMap as sharedBuildAliasMap,
  compileFrom as sharedCompileFrom,
  compileSelect as sharedCompileSelect,
} from "../../../../utils/sql/compile-select.js";
import { postgresDialect } from "../postgres-dialect.js";
import { buildInheritanceAliases } from "./compile-inheritance-join.js";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata.js";
import { resolveTableName } from "./resolve-table-name.js";

export type { AliasMap, BuiltAliasResult, InheritanceAliasMap };

const deps = {
  buildInheritanceAliases,
  resolveTableName,
  findRelationByKey,
  getRelationMetadata,
};

export const buildAliasMap = (
  rootMetadata: EntityMetadata,
  includes: Array<IncludeSpec>,
  defaultNamespace?: string | null,
): BuiltAliasResult =>
  sharedBuildAliasMap(rootMetadata, includes, postgresDialect, deps, defaultNamespace);

export const compileSelect = <E extends IEntity>(
  rootMetadata: EntityMetadata,
  aliasMap: Array<AliasMap>,
  selections: Array<keyof E> | null,
  includes: Array<IncludeSpec>,
  distinct: boolean,
  rawSelections?: Array<RawSelectEntry>,
  windows?: Array<WindowSpec<E>>,
  params?: Array<unknown>,
  inheritanceAliases?: Array<InheritanceAliasMap>,
): string =>
  sharedCompileSelect(
    rootMetadata,
    aliasMap,
    selections,
    includes,
    distinct,
    postgresDialect,
    deps,
    rawSelections,
    windows,
    params,
    inheritanceAliases,
  );

export const compileFrom = (aliasMap: Array<AliasMap>, cteFrom?: string | null): string =>
  sharedCompileFrom(aliasMap, postgresDialect, cteFrom);
