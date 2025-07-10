import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { ISagaErrorHandler } from "../interfaces";
import { HandlerIdentifier, SagaErrorCallback, SagaErrorHandlerOptions } from "../types";

export class HermesSagaErrorHandler<C extends Constructor<DomainError>>
  implements ISagaErrorHandler<C>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly error: string;
  public readonly saga: HandlerIdentifier;
  public readonly key: string;
  public readonly handler: SagaErrorCallback<C>;

  public constructor(options: SagaErrorHandlerOptions<C>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.error = options.error;
    this.key = options.key;
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.handler = options.handler;
  }
}
