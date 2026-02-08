import {
  MetaColumn,
  MetaEntity,
  MetaExtra,
  MetaGenerated,
  MetaHook,
  MetaIndex,
  MetaPrimaryKey,
  MetaPrimarySource,
  MetaSchema,
} from "./metadata";

export type GlobalEntityMetadata = {
  columns: Array<MetaColumn>;
  entities: Array<MetaEntity>;
  extras: Array<MetaExtra>;
  generated: Array<MetaGenerated>;
  hooks: Array<MetaHook>;
  indexes: Array<MetaIndex>;
  primaryKeys: Array<MetaPrimaryKey>;
  primarySources: Array<MetaPrimarySource>;
  schemas: Array<MetaSchema>;
};
