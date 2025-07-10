import { Constructor, Dict } from "@lindorm/types";
import { ISagaTimeoutHandler } from "../interfaces";
import {
  HandlerIdentifier,
  SagaTimeoutCallback,
  SagaTimeoutHandlerOptions,
} from "../types";

export class HermesSagaTimeoutHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> implements ISagaTimeoutHandler<C, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly timeout: string;
  public readonly key: string;
  public readonly saga: HandlerIdentifier;
  public readonly handler: SagaTimeoutCallback<C, S>;

  public constructor(options: SagaTimeoutHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      context: options.aggregate.context,
    };
    this.key = options.key;
    this.saga = {
      name: options.saga.name,
      context: options.saga.context,
    };
    this.timeout = options.timeout;
    this.handler = options.handler;
  }
}
