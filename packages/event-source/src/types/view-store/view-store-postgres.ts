import { ViewEntity } from "../../infrastructure";

export interface PostgresViewEventHandlerAdapterOptions {
  ViewEntity: typeof ViewEntity;
}
