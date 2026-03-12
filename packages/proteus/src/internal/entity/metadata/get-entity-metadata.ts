import type { Dict } from "@lindorm/types";
import type { MetaInheritance } from "../types/inheritance";
import type { EntityMetadata, MetaFieldDecorator } from "../types/metadata";
import { type BuildPrimaryOptions, buildPrimaryMetadata } from "./build-primary";
import { getCachedMetadata, setCachedMetadata } from "./registry";
import { resolveRelations } from "./resolve-relations";

export const getEntityMetadata = <
  TExtra extends Dict = Dict,
  TDecorator extends MetaFieldDecorator = MetaFieldDecorator,
>(
  target: Function,
  inheritanceMap?: Map<Function, MetaInheritance>,
): EntityMetadata<TExtra, TDecorator> => {
  const cached = getCachedMetadata(target);
  if (cached) return cached as EntityMetadata<TExtra, TDecorator>;

  const options: BuildPrimaryOptions | undefined = inheritanceMap
    ? { inheritance: inheritanceMap.get(target) }
    : undefined;

  const primaryMeta = buildPrimaryMetadata<TExtra, TDecorator>(target, options);
  const relations = resolveRelations(target, primaryMeta);
  const final: EntityMetadata<TExtra, TDecorator> = { ...primaryMeta, relations };

  setCachedMetadata(target, final);

  return final;
};
