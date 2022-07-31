import { ViewCausationEntity, ViewEntity } from "../../infrastructure";

export interface PostgresViewStoreHandlerOptions {
  causationEntity: typeof ViewCausationEntity;
  viewEntity: typeof ViewEntity;
}
