import { Entity, Index } from "typeorm";
import { snakeCase } from "lodash";
import {
  ViewCausationEntity as ExtendableViewCausationEntity,
  ViewEntity as ExtendableViewEntity,
} from "../infrastructure";

export interface CreateViewEntitiesResult {
  ViewEntity: typeof ExtendableViewEntity;
  ViewCausationEntity: typeof ExtendableViewCausationEntity;
}

export const createViewEntities = (
  viewName: string,
  table?: string,
  causationTable?: string,
): CreateViewEntitiesResult => {
  @Entity({ name: table || `${snakeCase(viewName)}` })
  @Index(["id", "name", "context"], { unique: true })
  @Index(["id", "name", "context", "revision"], { unique: true })
  class ViewEntity extends ExtendableViewEntity {}

  @Entity({ name: causationTable || `${snakeCase(viewName)}_causation` })
  @Index(["view_id", "view_name", "view_context"])
  @Index(["view_id", "view_name", "view_context", "causation_id"], {
    unique: true,
  })
  class ViewCausationEntity extends ExtendableViewCausationEntity {}

  return { ViewEntity, ViewCausationEntity };
};
