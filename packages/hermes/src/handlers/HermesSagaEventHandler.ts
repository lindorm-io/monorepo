import { snakeArray, snakeCase } from "@lindorm/case";
import { isArray } from "@lindorm/is";
import { ClassLike, Dict } from "@lindorm/types";
import { IHermesMessage, IHermesSagaEventHandler } from "../interfaces";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
} from "../types";
import { verifyIdentifierLength } from "../utils/private";

export class HermesSagaEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
  D extends ClassLike = ClassLike,
> implements IHermesSagaEventHandler<E, S, D>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly saga: HandlerIdentifier;
  public readonly version: number;
  public readonly getSagaId: (event: IHermesMessage<E>) => string;
  public readonly handler: (ctx: SagaEventHandlerContext<E, S, D>) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<E, S, D>) {
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: isArray(options.aggregate.context)
        ? snakeArray(options.aggregate.context)
        : snakeCase(options.aggregate.context),
    };
    this.conditions = options.conditions || {};
    this.eventName = snakeCase(options.eventName);
    this.saga = {
      name: snakeCase(options.saga.name),
      context: snakeCase(options.saga.context),
    };
    this.version = options.version || 1;
    this.getSagaId = options.getSagaId
      ? options.getSagaId
      : (event): string => event.aggregate.id;
    this.handler = options.handler;

    verifyIdentifierLength(options.aggregate);
  }
}
