import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { AggregateErrorCallback, HandlerIdentifier } from "../types";

export interface IAggregateErrorHandler<
  C extends Constructor<DomainError> = Constructor<DomainError>,
> {
  aggregate: HandlerIdentifier;
  error: string;
  handler: AggregateErrorCallback<C>;
}
