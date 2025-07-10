import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { HandlerIdentifier, ViewErrorCallback } from "../types";

export interface IViewErrorHandler<
  C extends Constructor<DomainError> = Constructor<DomainError>,
> {
  aggregate: HandlerIdentifier;
  error: string;
  view: HandlerIdentifier;
  handler: ViewErrorCallback<C>;
}
