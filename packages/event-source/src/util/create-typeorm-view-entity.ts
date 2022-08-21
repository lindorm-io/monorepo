import { Entity, Index } from "typeorm";
import { HandlerIdentifier } from "../types";
import { ViewEntity as ExtendableViewEntity } from "../infrastructure";
import { snakeCase } from "lodash";

export const createTypeormViewEntity = (view: HandlerIdentifier): typeof ExtendableViewEntity => {
  @Entity({ name: `view_${snakeCase(view.context)}_${snakeCase(view.name)}` })
  @Index(["id", "name", "context"], { unique: true })
  @Index(["id", "name", "context", "hash", "revision"], { unique: true })
  class ViewEntity extends ExtendableViewEntity {}

  return ViewEntity;
};
