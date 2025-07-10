import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { HandlerIdentifier, SagaErrorCallback } from "../types";

export interface ISagaErrorHandler<
  C extends Constructor<DomainError> = Constructor<DomainError>,
> {
  aggregate: HandlerIdentifier;
  error: string;
  saga: HandlerIdentifier;
  handler: SagaErrorCallback<C>;
}
