import type { Dict } from "@lindorm/types";
import type { MetaInheritance } from "../types/inheritance.js";
import type { EntityMetadata, MetaFieldDecorator } from "../types/metadata.js";
import { type BuildPrimaryOptions, buildPrimaryMetadata } from "./build-primary.js";
import { getCachedMetadata, setCachedMetadata } from "./registry.js";
import { resolveRelations } from "./resolve-relations.js";

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
