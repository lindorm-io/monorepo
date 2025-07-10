import { Constructor } from "@lindorm/types";
import { ISagaIdHandler } from "../interfaces";
import { HandlerIdentifier, SagaIdCallback, SagaIdHandlerOptions } from "../types";
import { NameData } from "../utils/private";

export class HermesSagaIdHandler<C extends Constructor> implements ISagaIdHandler<C> {
  public readonly aggregate: HandlerIdentifier;
  public readonly event: NameData;
  public readonly key: string;
  public readonly saga: HandlerIdentifier;
  public readonly handler: SagaIdCallback<C>;

  public constructor(options: SagaIdHandlerOptions<C>) {
    this.aggregate = {
      name: options.aggregate.name,
      context: options.aggregate.context,
    };
    this.event = options.event;
    this.key = options.key;
    this.saga = {
      name: options.saga.name,
      context: options.saga.context,
    };
    this.handler = options.handler;
  }
}
