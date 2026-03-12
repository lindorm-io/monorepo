import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaFieldDecorator } from "../types/metadata";
import { getEntityMetadata } from "./get-entity-metadata";
import { findEntityByName } from "./registry";

export const findEntityMetadata = <
  TExtra extends Dict = Dict,
  TDecorator extends MetaFieldDecorator = MetaFieldDecorator,
>(
  name: string,
): EntityMetadata<TExtra, TDecorator> | undefined => {
  const target = findEntityByName(name);
  if (!target) return undefined;
  return getEntityMetadata<TExtra, TDecorator>(target);
};
