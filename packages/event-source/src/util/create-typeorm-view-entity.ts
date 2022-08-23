import { Entity, Index } from "typeorm";
import { ViewEntity as ExtendableViewEntity } from "../infrastructure";
import { snakeCase } from "lodash";

export const createTypeormViewEntity = (
  name: string,
  context?: string,
): typeof ExtendableViewEntity => {
  @Entity({ name: `view_${snakeCase(context || "default")}_${snakeCase(name)}` })
  @Index(["id", "name", "context"], { unique: true })
  @Index(["id", "name", "context", "hash", "revision"], { unique: true })
  class ViewEntity extends ExtendableViewEntity {}

  return ViewEntity;
};
