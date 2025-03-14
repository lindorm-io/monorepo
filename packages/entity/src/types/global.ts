/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GlobalEntityMetadata } from "../classes/private";
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

export type GlobalMetadata = {
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

export type GlobalThisEntity = typeof globalThis & {
  __lindorm_entity__: GlobalEntityMetadata;
};
