import { Constructor, Dict } from "@lindorm/types";
import { ISagaEventHandler } from "../interfaces";
import {
  HandlerConditions,
  HandlerIdentifier,
  SagaEventCallback,
  SagaEventHandlerOptions,
} from "../types";
import { NameData, verifyIdentifierLength } from "../utils/private";

export class HermesSagaEventHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> implements ISagaEventHandler<C, S>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly conditions: HandlerConditions;
  public readonly event: NameData;
  public readonly key: string;
  public readonly saga: HandlerIdentifier;
  public readonly handler: SagaEventCallback<C, S>;

  public constructor(options: SagaEventHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      context: options.aggregate.context,
    };
    this.conditions = options.conditions || {};
    this.event = options.event;
    this.key = options.key;
    this.saga = {
      name: options.saga.name,
      context: options.saga.context,
    };
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
