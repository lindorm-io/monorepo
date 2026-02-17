import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { IAggregateErrorHandler } from "../interfaces";
import {
  AggregateErrorCallback,
  AggregateErrorHandlerOptions,
  HandlerIdentifier,
} from "../types";

export class HermesAggregateErrorHandler<
  C extends Constructor<DomainError>,
> implements IAggregateErrorHandler<C> {
  public readonly aggregate: HandlerIdentifier;
  public readonly error: string;
  public readonly key: string;
  public readonly handler: AggregateErrorCallback<C>;

  public constructor(options: AggregateErrorHandlerOptions<C>) {
    this.aggregate = {
      name: options.aggregate.name,
      namespace: options.aggregate.namespace,
    };
    this.error = options.error;
    this.key = options.key;
    this.handler = options.handler;
  }
}
