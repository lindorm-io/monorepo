/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Dict } from "@lindorm/types";
import {
  MetaColumn,
  MetaColumnDecorator,
  MetaEntity,
  MetaExtra,
  MetaGenerated,
  MetaHook,
  MetaIndex,
  MetaPrimaryKey,
  MetaPrimarySource,
  MetaRelation,
  MetaSchema,
  MetaSource,
} from "./metadata";

type WithTarget = { target: Function };

export type MetaColumnInternal<T extends MetaColumnDecorator = MetaColumnDecorator> =
  MetaColumn<T> & WithTarget;

export type MetaEntityInternal = MetaEntity & WithTarget;

export type MetaExtraInternal<T extends Dict = Dict> = MetaExtra<T> & WithTarget;

export type MetaGeneratedInternal = MetaGenerated & WithTarget;

export type MetaHookInternal = MetaHook & WithTarget;

export type MetaIndexInternal = MetaIndex & WithTarget;

export type MetaPrimaryKeyInternal = MetaPrimaryKey & WithTarget;

export type MetaRelationInternal = Omit<MetaRelation, "findKeys" | "joinKeys"> &
  WithTarget & {
    findKeys: Dict | Array<string> | boolean | null;
    joinKeys: Dict | Array<string> | boolean | null;
  };

export type MetaPrimarySourceInternal<T extends MetaSource = MetaSource> =
  MetaPrimarySource<T> & WithTarget;

export type MetaSchemaInternal = MetaSchema & WithTarget;
