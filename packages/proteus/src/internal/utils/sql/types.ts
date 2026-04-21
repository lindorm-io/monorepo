import type { EntityMetadata } from "../../entity/types/metadata.js";

export type AliasMap = {
  tableAlias: string;
  schema: string | null;
  tableName: string;
  relationKey: string | null;
  metadata: EntityMetadata;
};

export type InheritanceAliasMap = AliasMap & {
  childFields: EntityMetadata["fields"];
};

export type BuiltAliasResult = {
  aliasMap: Array<AliasMap>;
  inheritanceAliases: Array<InheritanceAliasMap>;
};
