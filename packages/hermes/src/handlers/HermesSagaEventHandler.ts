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
> implements ISagaEventHandler<C, S> {
  public readonly aggregate: HandlerIdentifier;
  public readonly conditions: HandlerConditions;
  public readonly event: NameData;
  public readonly key: string;
  public readonly saga: HandlerIdentifier;
  public readonly handler: SagaEventCallback<C, S>;

  public constructor(options: SagaEventHandlerOptions<C, S>) {
    this.aggregate = {
      name: options.aggregate.name,
      namespace: options.aggregate.namespace,
    };
    this.conditions = options.conditions || {};
    this.event = options.event;
    this.key = options.key;
    this.saga = {
      name: options.saga.name,
      namespace: options.saga.namespace,
    };
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
